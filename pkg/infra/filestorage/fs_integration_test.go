//go:build integration
// +build integration

package filestorage

import (
	"context"
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"gocloud.dev/blob"
)

const (
	pngImageBase64 = "iVBORw0KGgoNAANSUhEUgAAAC4AAAAmCAYAAAC76qlaAAAABHNCSVQICAgIfAhkiAAAABl0RVh0U29mdHdhcmUAZ25vbWUtc2NyZWVuc2hvdO8Dvz4AAABFSURBVFiF7c5BDQAhEACx4/x7XjzwGELSKuiamfke9N8OnBKvidfEa+I18Zp4TbwmXhOvidfEa+I18Zp4TbwmXhOvidc2lcsESD1LGnUAAAAASUVORK5CYII="
)

type fsTestCase struct {
	name  string
	skip  *bool
	steps []interface{}
}

func runTestCase(t *testing.T, testCase fsTestCase, ctx context.Context, filestorage FileStorage) {
	if testCase.skip != nil {
		return
	}
	for i, step := range testCase.steps {
		executeTestStep(t, ctx, step, i, filestorage)
	}
}

type backend string

const (
	backendSQL           backend = "sql"
	backendSQLNested     backend = "sqlNested"
	backendInMem         backend = "inMem"
	backendLocalFS       backend = "localFS"
	backendLocalFSNested backend = "localFSNested"
)

func runTests(createCases func() []fsTestCase, t *testing.T) {
	var testLogger log.Logger
	var sqlStore *sqlstore.SQLStore
	var filestorage FileStorage
	var ctx context.Context
	var tempDir string

	commonSetup := func() {
		testLogger = log.New("testStorageLogger")
		ctx = context.Background()
	}

	cleanUp := func() {
		testLogger = nil
		sqlStore = nil
		if filestorage != nil {
			_ = filestorage.close()
			filestorage = nil
		}

		ctx = nil
		_ = os.RemoveAll(tempDir)
	}

	setupInMemFS := func() {
		commonSetup()
		bucket, _ := blob.OpenBucket(context.Background(), "mem://")
		filestorage = NewCdkBlobStorage(testLogger, bucket, "", nil)
	}

	setupSqlFS := func() {
		commonSetup()
		sqlStore = sqlstore.InitTestDB(t)
		filestorage = NewDbStorage(testLogger, sqlStore, nil, "/")
	}

	setupSqlFSNestedPath := func() {
		commonSetup()
		sqlStore = sqlstore.InitTestDB(t)
		filestorage = NewDbStorage(testLogger, sqlStore, nil, "/5/dashboards/")
	}

	setupLocalFs := func() {
		commonSetup()
		tmpDir, err := ioutil.TempDir("", "")
		tempDir = tmpDir
		if err != nil {
			t.Fatal(err)
		}

		bucket, err := blob.OpenBucket(context.Background(), fmt.Sprintf("file://%s", tmpDir))
		if err != nil {
			t.Fatal(err)
		}
		filestorage = NewCdkBlobStorage(testLogger, bucket, "", nil)
	}

	setupLocalFsNestedPath := func() {
		commonSetup()
		tmpDir, err := ioutil.TempDir("", "")
		if err != nil {
			t.Fatal(err)
		}

		nestedPath := path.Join("a", "b")
		err = os.MkdirAll(path.Join(tmpDir, nestedPath), os.ModePerm)
		if err != nil {
			t.Fatal(err)
		}

		bucket, err := blob.OpenBucket(context.Background(), fmt.Sprintf("file://%s", tmpDir))
		if err != nil {
			t.Fatal(err)
		}
		filestorage = NewCdkBlobStorage(testLogger, bucket, nestedPath+Delimiter, nil)
	}

	backends := []struct {
		setup func()
		name  backend
	}{
		{
			setup: setupLocalFs,
			name:  backendLocalFS,
		},
		{
			setup: setupLocalFsNestedPath,
			name:  backendLocalFSNested,
		},
		{
			setup: setupInMemFS,
			name:  backendInMem,
		},
		{
			setup: setupSqlFS,
			name:  backendSQL,
		},
		{
			setup: setupSqlFSNestedPath,
			name:  backendSQLNested,
		},
	}

	skipBackends := map[backend]bool{
		backendInMem:         false,
		backendSQL:           false,
		backendLocalFS:       false,
		backendLocalFSNested: false,
		backendSQLNested:     false,
	}

	for _, backend := range backends {
		if skipBackends[backend.name] {
			continue
		}

		for _, tt := range createCases() {
			t.Run(fmt.Sprintf("%s: %s", backend.name, tt.name), func(t *testing.T) {
				backend.setup()
				defer cleanUp()
				runTestCase(t, tt, ctx, filestorage)
			})
		}
	}
}

func TestIntegrationFsStorage(t *testing.T) {
	//skipTest := true
	emptyContents := make([]byte, 0)
	pngImage, _ := base64.StdEncoding.DecodeString(pngImageBase64)
	pngImageSize := int64(len(pngImage))

	createListFilesTests := func() []fsTestCase {
		return []fsTestCase{
			{
				name: "listing files",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/folder1/folder2/file.jpg",
							Contents:   emptyContents,
							Properties: map[string]string{"prop1": "val1", "prop2": "val"},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/folder1/file-inner.jpg",
							Contents:   emptyContents,
							Properties: map[string]string{"prop1": "val1", "prop2": "val"},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/file-inner2.jpg",
							Contents: emptyContents,
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: true}},
						list:  checks(listSize(3), listHasMore(false), listLastPath("/folder1/folder2/file.jpg")),
						files: [][]interface{}{
							checks(fPath("/folder1/file-inner.jpg"), fProperties(map[string]string{"prop1": "val1", "prop2": "val"})),
							checks(fPath("/folder1/file-inner2.jpg"), fProperties(map[string]string{})),
							checks(fPath("/folder1/folder2/file.jpg"), fProperties(map[string]string{"prop1": "val1", "prop2": "val"})),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: true, WithFiles: true, WithFolders: true}},
						list:  checks(listSize(4), listHasMore(false), listLastPath("/folder1/folder2/file.jpg")),
						files: [][]interface{}{
							checks(fPath("/folder1/file-inner.jpg"), fProperties(map[string]string{"prop1": "val1", "prop2": "val"})),
							checks(fPath("/folder1/file-inner2.jpg"), fProperties(map[string]string{})),
							checks(fPath("/folder1/folder2"), fProperties(map[string]string{}), fMimeType(DirectoryMimeType)),
							checks(fPath("/folder1/folder2/file.jpg"), fProperties(map[string]string{"prop1": "val1", "prop2": "val"})),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: false}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
						files: [][]interface{}{},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: false, WithFolders: true, WithFiles: true}},
						list:  checks(listSize(1), listHasMore(false), listLastPath("/folder1")),
						files: [][]interface{}{
							checks(fPath("/folder1"), fProperties(map[string]string{}), fMimeType(DirectoryMimeType)),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: false}},
						list:  checks(listSize(2), listHasMore(false), listLastPath("/folder1/file-inner2.jpg")),
						files: [][]interface{}{
							checks(fPath("/folder1/file-inner.jpg"), fProperties(map[string]string{"prop1": "val1", "prop2": "val"})),
							checks(fPath("/folder1/file-inner2.jpg"), fProperties(map[string]string{})),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: false, WithFolders: true, WithFiles: true}},
						list:  checks(listSize(3), listHasMore(false), listLastPath("/folder1/folder2")),
						files: [][]interface{}{
							checks(fPath("/folder1/file-inner.jpg"), fProperties(map[string]string{"prop1": "val1", "prop2": "val"})),
							checks(fPath("/folder1/file-inner2.jpg"), fProperties(map[string]string{})),
							checks(fPath("/folder1/folder2"), fProperties(map[string]string{}), fMimeType(DirectoryMimeType)),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/folder2", options: &ListOptions{Recursive: false}},
						list:  checks(listSize(1), listHasMore(false), listLastPath("/folder1/folder2/file.jpg")),
						files: [][]interface{}{
							checks(fPath("/folder1/folder2/file.jpg"), fProperties(map[string]string{"prop1": "val1", "prop2": "val"})),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/folder2", options: &ListOptions{Recursive: false, WithFolders: true, WithFiles: true}},
						list:  checks(listSize(1), listHasMore(false), listLastPath("/folder1/folder2/file.jpg")),
						files: [][]interface{}{
							checks(fPath("/folder1/folder2/file.jpg"), fProperties(map[string]string{"prop1": "val1", "prop2": "val"})),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/folder2", options: &ListOptions{Recursive: false}, paging: &Paging{After: "/folder1/folder2/file.jpg"}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
						files: [][]interface{}{},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/folder2", options: &ListOptions{Recursive: false, WithFolders: true, WithFiles: true}, paging: &Paging{After: "/folder1/folder2/file.jpg"}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
						files: [][]interface{}{},
					},
				},
			},
			{
				name: "path passed to listing files is a folder path, not a prefix",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/ab/a.jpg",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/ab/a/a.jpg",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/ac/a.jpg",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/aba/a.jpg",
							Contents: emptyContents,
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/ab", options: &ListOptions{Recursive: true}},
						list:  checks(listSize(2), listHasMore(false), listLastPath("/ab/a/a.jpg")),
						files: [][]interface{}{
							checks(fPath("/ab/a.jpg")),
							checks(fPath("/ab/a/a.jpg")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/ab", options: &ListOptions{Recursive: true, WithFolders: true, WithFiles: true}},
						list:  checks(listSize(3), listHasMore(false), listLastPath("/ab/a/a.jpg")),
						files: [][]interface{}{
							checks(fPath("/ab/a.jpg")),
							checks(fPath("/ab/a"), fMimeType(DirectoryMimeType)),
							checks(fPath("/ab/a/a.jpg")),
						},
					},
				},
			},
			{
				name: "listing files with path to a file",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/folder1/folder2/file.jpg",
							Contents:   emptyContents,
							Properties: map[string]string{"prop1": "val1", "prop2": "val"},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/folder1/file-inner.jpg",
							Contents:   emptyContents,
							Properties: map[string]string{"prop1": "val1"},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/dashboards/dashboards/file-inner.jpg",
							Contents:   emptyContents,
							Properties: map[string]string{"prop1": "val1"},
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/file-inner.jp", options: &ListOptions{Recursive: true}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/file-inner.jp", options: &ListOptions{Recursive: true, WithFolders: true, WithFiles: true}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/file-inner", options: &ListOptions{Recursive: true}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/file-inner", options: &ListOptions{Recursive: true, WithFolders: true, WithFiles: true}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/folder2/file.jpg", options: &ListOptions{Recursive: true}},
						list:  checks(listSize(1), listHasMore(false), listLastPath("/folder1/folder2/file.jpg")),
						files: [][]interface{}{
							checks(fPath("/folder1/folder2/file.jpg"), fName("file.jpg"), fProperties(map[string]string{"prop1": "val1", "prop2": "val"})),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/folder2/file.jpg", options: &ListOptions{Recursive: true, WithFolders: true, WithFiles: true}},
						list:  checks(listSize(1), listHasMore(false), listLastPath("/folder1/folder2/file.jpg")),
						files: [][]interface{}{
							checks(fPath("/folder1/folder2/file.jpg"), fName("file.jpg"), fProperties(map[string]string{"prop1": "val1", "prop2": "val"})),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/file-inner.jpg", options: &ListOptions{Recursive: true}},
						list:  checks(listSize(1), listHasMore(false), listLastPath("/folder1/file-inner.jpg")),
						files: [][]interface{}{
							checks(fPath("/folder1/file-inner.jpg"), fName("file-inner.jpg"), fProperties(map[string]string{"prop1": "val1"})),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/dashboards/dashboards/file-inner.jpg", options: &ListOptions{Recursive: true, WithFiles: true}},
						list:  checks(listSize(1), listHasMore(false), listLastPath("/dashboards/dashboards/file-inner.jpg")),
						files: [][]interface{}{
							checks(fPath("/dashboards/dashboards/file-inner.jpg"), fName("file-inner.jpg")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/file-inner.jpg", options: &ListOptions{Recursive: true, WithFolders: true, WithFiles: true}},
						list:  checks(listSize(1), listHasMore(false), listLastPath("/folder1/file-inner.jpg")),
						files: [][]interface{}{
							checks(fPath("/folder1/file-inner.jpg"), fName("file-inner.jpg"), fProperties(map[string]string{"prop1": "val1"})),
						},
					},
				},
			},
			{
				name: "listing files with prefix filter",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/folder2/file.jpg",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/file-inner.jpg",
							Contents: emptyContents,
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: true, Filter: NewPathFilter([]string{"/folder2"}, nil, nil, nil)}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: true, WithFiles: true, WithFolders: true, Filter: NewPathFilter([]string{"/folder2"}, nil, nil, nil)}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
						files: [][]interface{}{},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: true, Filter: NewPathFilter([]string{"/folder1/folder"}, nil, nil, nil)}},
						list:  checks(listSize(1), listHasMore(false)),
						files: [][]interface{}{
							checks(fPath("/folder1/folder2/file.jpg")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: true, WithFiles: true, WithFolders: true, Filter: NewPathFilter([]string{"/folder1/folder"}, nil, nil, nil)}},
						list:  checks(listSize(2), listHasMore(false)),
						files: [][]interface{}{
							checks(fPath("/folder1/folder2"), fMimeType("directory")),
							checks(fPath("/folder1/folder2/file.jpg")),
						},
					},
				},
			},
			{
				name: "listing files with pagination",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/a",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/b",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder2/c",
							Contents: emptyContents,
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true}, paging: &Paging{First: 2, After: ""}},
						list:  checks(listSize(2), listHasMore(true), listLastPath("/folder1/b")),
						files: [][]interface{}{
							checks(fPath("/folder1/a")),
							checks(fPath("/folder1/b")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true, WithFiles: true, WithFolders: true}, paging: &Paging{First: 2, After: ""}},
						list:  checks(listSize(2), listHasMore(true), listLastPath("/folder1/a")),
						files: [][]interface{}{
							checks(fPath("/folder1"), fMimeType(DirectoryMimeType)),
							checks(fPath("/folder1/a")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true, WithFiles: true, WithFolders: true}, paging: &Paging{First: 1, After: "/folder1"}},
						list:  checks(listSize(1), listHasMore(true), listLastPath("/folder1/a")),
						files: [][]interface{}{
							checks(fPath("/folder1/a")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true}, paging: &Paging{First: 1, After: "/folder1/a"}},
						list:  checks(listSize(1), listHasMore(true), listLastPath("/folder1/b")),
						files: [][]interface{}{
							checks(fPath("/folder1/b")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true, WithFiles: true, WithFolders: true}, paging: &Paging{First: 1, After: "/folder1/a"}},
						list:  checks(listSize(1), listHasMore(true), listLastPath("/folder1/b")),
						files: [][]interface{}{
							checks(fPath("/folder1/b")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true}, paging: &Paging{First: 1, After: "/folder1/b"}},
						list:  checks(listSize(1), listHasMore(false), listLastPath("/folder2/c")),
						files: [][]interface{}{
							checks(fPath("/folder2/c")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true, WithFiles: true, WithFolders: true}, paging: &Paging{First: 1, After: "/folder1/b"}},
						list:  checks(listSize(1), listHasMore(true), listLastPath("/folder2")),
						files: [][]interface{}{
							checks(fPath("/folder2"), fMimeType(DirectoryMimeType)),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true, WithFiles: true, WithFolders: true}, paging: &Paging{First: 1, After: "/folder2"}},
						list:  checks(listSize(1), listHasMore(false), listLastPath("/folder2/c")),
						files: [][]interface{}{
							checks(fPath("/folder2/c")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true}, paging: &Paging{First: 5, After: ""}},
						list:  checks(listSize(3), listHasMore(false), listLastPath("/folder2/c")),
						files: [][]interface{}{
							checks(fPath("/folder1/a")),
							checks(fPath("/folder1/b")),
							checks(fPath("/folder2/c")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true, WithFiles: true, WithFolders: true}, paging: &Paging{First: 5, After: ""}},
						list:  checks(listSize(5), listHasMore(false), listLastPath("/folder2/c")),
						files: [][]interface{}{
							checks(fPath("/folder1"), fMimeType(DirectoryMimeType)),
							checks(fPath("/folder1/a")),
							checks(fPath("/folder1/b")),
							checks(fPath("/folder2"), fMimeType(DirectoryMimeType)),
							checks(fPath("/folder2/c")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true}, paging: &Paging{First: 5, After: "/folder2"}},
						list:  checks(listSize(1), listHasMore(false)),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true, WithFiles: true, WithFolders: true}, paging: &Paging{First: 5, After: "/folder2"}},
						list:  checks(listSize(1), listHasMore(false)),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true}, paging: &Paging{First: 5, After: "/folder2/c"}},
						list:  checks(listSize(0), listHasMore(false)),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true, WithFiles: true, WithFolders: true}, paging: &Paging{First: 5, After: "/folder2/c"}},
						list:  checks(listSize(0), listHasMore(false)),
					},
				},
			},
		}
	}

	createListFoldersTests := func() []fsTestCase {
		return []fsTestCase{
			{
				name: "listing folders",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/folder2/file.jpg",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/file-inner.jpg",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folderX/folderZ/file.txt",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folderA/folderB/file.txt",
							Contents: emptyContents,
						},
					},
					queryListFolders{
						input: queryListFoldersInput{path: "/", options: &ListOptions{Recursive: true}},
						checks: [][]interface{}{
							checks(fPath("/folder1")),
							checks(fPath("/folder1/folder2")),
							checks(fPath("/folderA")),
							checks(fPath("/folderA/folderB")),
							checks(fPath("/folderX")),
							checks(fPath("/folderX/folderZ")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true, WithFiles: false, WithFolders: true}},
						list:  checks(listSize(6), listHasMore(false), listLastPath("/folderX/folderZ")),
						files: [][]interface{}{
							checks(fPath("/folder1"), fMimeType(DirectoryMimeType)),
							checks(fPath("/folder1/folder2"), fMimeType(DirectoryMimeType)),
							checks(fPath("/folderA"), fMimeType(DirectoryMimeType)),
							checks(fPath("/folderA/folderB"), fMimeType(DirectoryMimeType)),
							checks(fPath("/folderX"), fMimeType(DirectoryMimeType)),
							checks(fPath("/folderX/folderZ"), fMimeType(DirectoryMimeType)),
						},
					},
				},
			},
			{
				name: "listing folders non recursively",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/folder2/file.jpg",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/file-inner.jpg",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folderX/folderZ/file.txt",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folderA/folderB/file.txt",
							Contents: emptyContents,
						},
					},
					queryListFolders{
						input: queryListFoldersInput{path: "/folder1", options: &ListOptions{Recursive: false}},
						checks: [][]interface{}{
							checks(fPath("/folder1/folder2")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: false, WithFiles: false, WithFolders: true}},
						list:  checks(listSize(1), listHasMore(false), listLastPath("/folder1/folder2")),
						files: [][]interface{}{
							checks(fPath("/folder1/folder2"), fMimeType(DirectoryMimeType)),
						},
					},
					queryListFolders{
						input:  queryListFoldersInput{path: "/folderZ", options: &ListOptions{Recursive: false}},
						checks: [][]interface{}{},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folderZ", options: &ListOptions{Recursive: false, WithFiles: false, WithFolders: true}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
						files: [][]interface{}{},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1/folder2", options: &ListOptions{Recursive: false, WithFiles: false, WithFolders: true}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
						files: [][]interface{}{},
					},
					queryListFolders{
						input: queryListFoldersInput{path: "/", options: &ListOptions{Recursive: false}},
						checks: [][]interface{}{
							checks(fPath("/folder1")),
							checks(fPath("/folderA")),
							checks(fPath("/folderX")),
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: false, WithFiles: false, WithFolders: true}},
						list:  checks(listSize(3), listHasMore(false), listLastPath("/folderX")),
						files: [][]interface{}{
							checks(fPath("/folder1"), fMimeType(DirectoryMimeType)),
							checks(fPath("/folderA"), fMimeType(DirectoryMimeType)),
							checks(fPath("/folderX"), fMimeType(DirectoryMimeType)),
						},
					},
				},
			},
		}
	}

	createFileCRUDTests := func() []fsTestCase {
		return []fsTestCase{
			{
				name: "getting a non-existent file",
				steps: []interface{}{
					queryGet{
						input: queryGetInput{
							path: "/folder/a.png",
						},
					},
				},
			},
			{
				name: "inserting a file",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/folder/a.png",
							Contents:   pngImage,
							Properties: map[string]string{"prop1": "val1", "prop2": "val"},
						},
					},
					queryGet{
						input: queryGetInput{
							path: "/folder/a.png",
						},
						checks: checks(
							fPath("/folder/a.png"),
							fName("a.png"),
							fMimeType("image/png"),
							fProperties(map[string]string{"prop1": "val1", "prop2": "val"}),
							fSize(pngImageSize),
							fContents(pngImage),
						),
					},
				},
			},
			{
				name: "preserved original path/name casing when getting a file",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/Folder/A.png",
							Contents: emptyContents,
						},
					},
					queryGet{
						input: queryGetInput{
							path: "/fOlder/a.png",
						},
						checks: checks(
							fPath("/Folder/A.png"),
							fName("A.png"),
						),
					},
				},
			},
			{
				name: "modifying file metadata",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/a.png",
							Contents:   pngImage,
							Properties: map[string]string{"a": "av", "b": "bv"},
						},
					},
					queryGet{
						input: queryGetInput{
							path: "/a.png",
						},
						checks: checks(
							fContents(pngImage),
							fProperties(map[string]string{"a": "av", "b": "bv"}),
						),
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/a.png",
							Properties: map[string]string{"b": "bv2", "c": "cv"},
						},
					},
					queryGet{
						input: queryGetInput{
							path: "/a.png",
						},
						checks: checks(
							fContents(pngImage),
							fProperties(map[string]string{"b": "bv2", "c": "cv"}),
						),
					},
				},
			},
			{
				name: "modifying file metadata preserves original path casing",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/aB.png",
							Contents:   emptyContents,
							Properties: map[string]string{"a": "av", "b": "bv"},
						},
					},
					queryGet{
						input: queryGetInput{
							path: "/ab.png",
						},
						checks: checks(
							fPath("/aB.png"),
							fName("aB.png"),
						),
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/ab.png",
							Properties: map[string]string{"b": "bv2", "c": "cv"},
						},
					},
					queryGet{
						input: queryGetInput{
							path: "/ab.png",
						},
						checks: checks(
							fPath("/aB.png"),
							fName("aB.png"),
							fProperties(map[string]string{"b": "bv2", "c": "cv"}),
						),
					},
				},
			},
			{
				name: "modifying file contents",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/FILE.png",
							Contents:   emptyContents,
							Properties: map[string]string{"a": "av", "b": "bv"},
						},
					},
					queryGet{
						input: queryGetInput{
							path: "/file.png",
						},
						checks: checks(
							fName("FILE.png"),
							fProperties(map[string]string{"a": "av", "b": "bv"}),
							fSize(0),
							fContents(emptyContents),
						),
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/file.png",
							Contents: pngImage,
						},
					},
					queryGet{
						input: queryGetInput{
							path: "/file.png",
						},
						checks: checks(
							fName("FILE.png"),
							fMimeType("image/png"),
							fProperties(map[string]string{"a": "av", "b": "bv"}),
							fSize(pngImageSize),
							fContents(pngImage),
						),
					},
				},
			},
			{
				name: "deleting a file",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/FILE.png",
							Contents:   emptyContents,
							Properties: map[string]string{"a": "av", "b": "bv"},
						},
					},
					queryGet{
						input: queryGetInput{
							path: "/file.png",
						},
						checks: checks(
							fPath("/FILE.png"),
						),
					},
					cmdDelete{
						path: "/file.png",
					},
					queryGet{
						input: queryGetInput{
							path: "/file.png",
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/file.png",
							Contents:   emptyContents,
							Properties: map[string]string{"a": "av", "b": "bv"},
						},
					},
					queryGet{
						input: queryGetInput{
							path: "/file.png",
						},
						checks: checks(
							fPath("/file.png"),
						),
					},
				},
			},
			{
				name: "deleting a non-existent file should be no-op",
				steps: []interface{}{
					cmdDelete{
						path: "/file.png",
					},
				},
			},
		}
	}

	createFolderCrudCases := func() []fsTestCase {
		return []fsTestCase{
			{
				name: "recreating a folder after it was already created via upserting a file is a no-op",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/aB/cD/eF/file.jpg",
							Contents: emptyContents,
						},
					},
					queryListFolders{
						input: queryListFoldersInput{
							path: "/",
						},
						checks: [][]interface{}{
							checks(fPath("/aB")),
							checks(fPath("/aB/cD")),
							checks(fPath("/aB/cD/eF")),
						},
					},
					cmdCreateFolder{
						path: "/ab/cd/ef",
					},
					queryListFolders{
						input: queryListFoldersInput{
							path: "/",
						},
						checks: [][]interface{}{
							checks(fPath("/aB")),
							checks(fPath("/aB/cD")),
							checks(fPath("/aB/cD/eF")),
						},
					},
					cmdCreateFolder{
						path: "/ab/cd/ef/GH",
					},
					queryListFolders{
						input: queryListFoldersInput{
							path: "/",
						},
						checks: [][]interface{}{
							checks(fPath("/aB")),
							checks(fPath("/aB/cD")),
							checks(fPath("/aB/cD/eF")),
							checks(fPath("/aB/cD/eF/GH")),
						},
					},
				},
			},
			{
				name: "creating a folder with the same name or same name but different casing is a no-op",
				steps: []interface{}{
					cmdCreateFolder{
						path: "/aB",
					},
					cmdCreateFolder{
						path: "/ab",
					},
					cmdCreateFolder{
						path: "/aB",
					},
					queryListFolders{
						input: queryListFoldersInput{
							path: "/",
						},
						checks: [][]interface{}{
							checks(fPath("/aB")),
						},
					},
					cmdCreateFolder{
						path: "/Ab",
					},
					queryListFolders{
						input: queryListFoldersInput{
							path: "/",
						},
						checks: [][]interface{}{
							checks(fPath("/aB")),
						},
					},
				},
			},
			{
				name: "creating folder is recursive",
				steps: []interface{}{
					cmdCreateFolder{
						path: "/a/b/c",
					},
					queryListFolders{
						input: queryListFoldersInput{
							path: "/",
						},
						checks: [][]interface{}{
							checks(fPath("/a")),
							checks(fPath("/a/b")),
							checks(fPath("/a/b/c")),
						},
					},
				},
			},
			{
				name: "deleting a leaf directory does not delete parent directories even if they are empty - folders created directly",
				steps: []interface{}{
					cmdCreateFolder{
						path: "/a/b/c",
					},
					cmdDeleteFolder{
						path: "/a/b/c",
					},
					queryListFolders{
						input: queryListFoldersInput{
							path: "/",
						},
						checks: [][]interface{}{
							checks(fPath("/a")),
							checks(fPath("/a/b")),
						},
					},
				},
			},
			{
				name: "deleting a leaf directory does not delete parent directories even if they are empty - folders created via file upsert",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/a/b/c/file.jpg",
							Contents: emptyContents,
						},
					},
					queryListFolders{
						input: queryListFoldersInput{
							path: "/",
						},
						checks: [][]interface{}{
							checks(fPath("/a")),
							checks(fPath("/a/b")),
							checks(fPath("/a/b/c")),
						},
					},
					cmdDelete{
						path:  "/a/b/c/file.jpg",
						error: nil,
					},
					queryListFolders{
						input: queryListFoldersInput{
							path: "/",
						},
						checks: [][]interface{}{
							checks(fPath("/a")),
							checks(fPath("/a/b")),
							checks(fPath("/a/b/c")),
						},
					},
					cmdDeleteFolder{
						path: "/a/b/c",
					},
					queryListFolders{
						input: queryListFoldersInput{
							path: "/",
						},
						checks: [][]interface{}{
							checks(fPath("/a")),
							checks(fPath("/a/b")),
						},
					},
				},
			},
			{
				name: "folders preserve their original casing",
				steps: []interface{}{
					cmdCreateFolder{
						path: "/aB/cD/e",
					},
					cmdCreateFolder{
						path: "/ab/cd/f",
					},
					queryListFolders{
						input: queryListFoldersInput{
							path: "/",
						},
						checks: [][]interface{}{
							checks(fPath("/aB")),
							checks(fPath("/aB/cD")),
							checks(fPath("/aB/cD/e")),
							checks(fPath("/aB/cD/f")),
						},
					},
				},
			},
			{
				name: "folders can't be deleted through the `delete` method",
				steps: []interface{}{
					cmdCreateFolder{
						path: "/folder/dashboards/myNewFolder",
					},
					queryListFolders{
						input: queryListFoldersInput{path: "/", options: &ListOptions{Recursive: true}},
						checks: [][]interface{}{
							checks(fPath("/folder")),
							checks(fPath("/folder/dashboards")),
							checks(fPath("/folder/dashboards/myNewFolder")),
						},
					},
					cmdDelete{
						path: "/folder/dashboards/myNewFolder",
					},
					queryListFolders{
						input: queryListFoldersInput{path: "/", options: &ListOptions{Recursive: true}},
						checks: [][]interface{}{
							checks(fPath("/folder")),
							checks(fPath("/folder/dashboards")),
							checks(fPath("/folder/dashboards/myNewFolder")),
						},
					},
				},
			},
			{
				name: "folders can not be retrieved through the `get` method",
				steps: []interface{}{
					cmdCreateFolder{
						path: "/folder/dashboards/myNewFolder",
					},
					queryGet{
						input: queryGetInput{
							path: "/folder/dashboards/myNewFolder",
						},
					},
				},
			},
			{
				name: "should not be able to delete folders with files",
				steps: []interface{}{
					cmdCreateFolder{
						path: "/folder/dashboards/myNewFolder",
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder/dashboards/myNewFolder/file.jpg",
							Contents: emptyContents,
						},
					},
					cmdDeleteFolder{
						path: "/folder/dashboards/myNewFolder",
						error: &cmdErrorOutput{
							message: "folder %s is not empty - cant remove it",
							args:    []interface{}{"/folder/dashboards/myNewFolder"},
						},
					},
					queryListFolders{
						input: queryListFoldersInput{path: "/", options: &ListOptions{Recursive: true}},
						checks: [][]interface{}{
							checks(fPath("/folder")),
							checks(fPath("/folder/dashboards")),
							checks(fPath("/folder/dashboards/myNewFolder")),
						},
					},
					queryGet{
						input: queryGetInput{
							path: "/folder/dashboards/myNewFolder/file.jpg",
						},
						checks: checks(
							fName("file.jpg"),
						),
					},
				},
			},
		}
	}

	createPathFiltersCases := func() []fsTestCase {
		pathFilters := NewPathFilter(
			[]string{"/gitB/", "/s3/folder/", "/gitC/"},
			[]string{"/gitA/dashboard2.json"},
			[]string{"/s3/folder/nested/"},
			[]string{"/gitC/nestedC/"},
		)
		return []fsTestCase{
			{
				name: "catch-all test - TODO: split into multiple",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/s3/folder/dashboard.json",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/s3/folder/nested/dashboard.json",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/gitA/dashboard1.json",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/gitA/dashboard2.json",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/gitB/nested/dashboard.json",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/gitB/nested2/dashboard2.json",
							Contents: emptyContents,
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/gitC/nestedC/dashboardC.json",
							Contents: emptyContents,
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{
							Recursive: true,
							Filter:    NewAllowAllPathFilter(),
						}},
						list: checks(listSize(7)),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{
							Recursive: true,
							Filter:    NewDenyAllPathFilter(),
						}},
						list: checks(listSize(0)),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{
							Recursive: true,
							Filter:    pathFilters,
						}},
						list: checks(listSize(5), listHasMore(false), listLastPath("/s3/folder/dashboard.json")),
						files: [][]interface{}{
							// /gitA/dashboard.json is not explicitly allowed
							checks(fPath("/gitA/dashboard2.json")),         // explicitly allowed by allowedPath
							checks(fPath("/gitB/nested/dashboard.json")),   // allowed by '/gitB/' prefix
							checks(fPath("/gitB/nested2/dashboard2.json")), // allowed by '/gitB/' prefix
							checks(fPath("/gitC/nestedC/dashboardC.json")), // allowed by '/gitC/' prefix
							checks(fPath("/s3/folder/dashboard.json")),     // allowed by '/s3/folder/' prefix
							// /s3/folder/nested/dashboard.json is denied with '/s3/folder/nested/' prefix
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{
							Recursive:   true,
							Filter:      pathFilters,
							WithFiles:   true,
							WithFolders: true,
						}},
						list: checks(listSize(10), listHasMore(false), listLastPath("/s3/folder/dashboard.json")),
						files: [][]interface{}{
							// /gitA/dashboard.json is not explicitly allowed
							checks(fPath("/gitA/dashboard2.json")),         // explicitly allowed by allowedPath
							checks(fPath("/gitB")),                         // allowed by '/gitB/' prefix
							checks(fPath("/gitB/nested")),                  // allowed by '/gitB/' prefix
							checks(fPath("/gitB/nested/dashboard.json")),   // allowed by '/gitB/' prefix
							checks(fPath("/gitB/nested2")),                 // allowed by '/gitB/' prefix
							checks(fPath("/gitB/nested2/dashboard2.json")), // allowed by '/gitB/' prefix
							checks(fPath("/gitC")),                         // allowed by '/gitC/' prefix
							// /gitC/nestedC is explicitly denied
							checks(fPath("/gitC/nestedC/dashboardC.json")), // allowed by '/gitC/' prefix
							// /s3 is not explicitly allowed
							checks(fPath("/s3/folder")),
							checks(fPath("/s3/folder/dashboard.json")), // allowed by '/s3/folder/' prefix
							// /s3/folder/nested/dashboard.json is denied with '/s3/folder/nested/' prefix
						},
					},
					queryListFolders{
						input: queryListFoldersInput{path: "/", options: &ListOptions{
							Recursive: true,
							Filter:    pathFilters,
						}},
						checks: [][]interface{}{
							// /gitA is missing due to the lack of explicit allow
							checks(fPath("/gitB")),         // allowed by '/gitB/' prefix
							checks(fPath("/gitB/nested")),  // allowed by '/gitB/' prefix
							checks(fPath("/gitB/nested2")), // allowed by '/gitB/' prefix
							checks(fPath("/gitC")),         // allowed by '/gitC/' prefix
							// /gitC/nestedC is explicitly denied
							// /s3 is not explicitly allowed
							checks(fPath("/s3/folder")),
							// /s3/folder/nested is denied with '/s3/folder/nested/' prefix
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/gitA", options: &ListOptions{
							Recursive: false,
							Filter:    pathFilters,
						}},
						list: checks(listSize(1), listHasMore(false), listLastPath("/gitA/dashboard2.json")),
						files: [][]interface{}{
							checks(fPath("/gitA/dashboard2.json")),
						},
					},
					queryListFolders{
						input: queryListFoldersInput{path: "/gitA", options: &ListOptions{
							Recursive: false,
							Filter:    pathFilters,
						}},
						checks: [][]interface{}{},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/gitC", options: &ListOptions{
							Recursive: false,
							Filter:    pathFilters,
						}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
						files: [][]interface{}{},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/gitC/nestedC", options: &ListOptions{
							Recursive: false,
							Filter:    pathFilters,
						}},
						list: checks(listSize(1), listHasMore(false), listLastPath("/gitC/nestedC/dashboardC.json")),
						files: [][]interface{}{
							checks(fPath("/gitC/nestedC/dashboardC.json")),
						},
					},
					queryListFolders{
						input: queryListFoldersInput{path: "/gitC", options: &ListOptions{
							Recursive: false,
							Filter:    pathFilters,
						}},
						checks: [][]interface{}{},
					},
				},
			},
		}
	}

	runTests(createListFoldersTests, t)
	runTests(createListFilesTests, t)
	runTests(createFileCRUDTests, t)
	runTests(createFolderCrudCases, t)
	runTests(createPathFiltersCases, t)
}
