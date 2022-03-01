//go:build integration
// +build integration

package filestorage

import (
	"context"
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
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

func runTests(createCases func() []fsTestCase, t *testing.T) {
	var testLogger log.Logger
	//var sqlStore *sqlstore.SQLStore
	var filestorage FileStorage
	var ctx context.Context
	var tempDir string

	commonSetup := func() {
		testLogger = log.New("testStorageLogger")
		ctx = context.Background()
	}

	cleanUp := func() {
		testLogger = nil
		//sqlStore = nil
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
		filestorage = NewCdkBlobStorage(testLogger, bucket, Delimiter, nil)
	}

	//setupSqlFS := func() {
	//	commonSetup()
	//	sqlStore = sqlstore.InitTestDB(t)
	//	filestorage = NewDbStorage(testLogger, sqlStore, nil)
	//}

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

	backends := []struct {
		setup func()
		name  string
	}{
		{
			setup: setupLocalFs,
			name:  "Local FS",
		},
		{
			setup: setupInMemFS,
			name:  "In-mem FS",
		},
		//{
		//	setup: setupSqlFS,
		//	name:  "SQL FS",
		//},
	}

	for _, backend := range backends {
		for _, tt := range createCases() {
			t.Run(fmt.Sprintf("%s: %s", backend.name, tt.name), func(t *testing.T) {
				backend.setup()
				defer cleanUp()
				runTestCase(t, tt, ctx, filestorage)
			})
		}
	}
}

func TestFsStorage(t *testing.T) {
	//skipTest := true
	emptyFileBytes := make([]byte, 0)
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
							Contents:   &[]byte{},
							Properties: map[string]string{"prop1": "val1", "prop2": "val"},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:       "/folder1/file-inner.jpg",
							Contents:   &[]byte{},
							Properties: map[string]string{"prop1": "val1", "prop2": "val"},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/file-inner2.jpg",
							Contents: &[]byte{},
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
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: false}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
						files: [][]interface{}{},
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
						input: queryListFilesInput{path: "/folder1/folder2", options: &ListOptions{Recursive: false}},
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
				},
			},
			{
				name: "path passed to listing files is a folder path, not a prefix",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/ab/a.jpg",
							Contents: &[]byte{},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/ab/a/a.jpg",
							Contents: &[]byte{},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/ac/a.jpg",
							Contents: &[]byte{},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/aba/a.jpg",
							Contents: &[]byte{},
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
				},
			},
			{
				name: "listing files with prefix filter",
				steps: []interface{}{
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/folder2/file.jpg",
							Contents: &[]byte{},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/file-inner.jpg",
							Contents: &[]byte{},
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: true, PathFilters: PathFilters{allowedPrefixes: []string{"/folder2"}}}},
						list:  checks(listSize(0), listHasMore(false), listLastPath("")),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: true, PathFilters: PathFilters{allowedPrefixes: []string{"/folder1/folder"}}}},
						list:  checks(listSize(1), listHasMore(false)),
						files: [][]interface{}{
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
							Contents: &[]byte{},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/b",
							Contents: &[]byte{},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder2/c",
							Contents: &[]byte{},
						},
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true}, paging: &Paging{First: 1, After: ""}},
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
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true}, paging: &Paging{First: 1, After: "/folder1/b"}},
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
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true}, paging: &Paging{First: 5, After: "/folder2"}},
						list:  checks(listSize(1), listHasMore(false)),
					},
					queryListFiles{
						input: queryListFilesInput{path: "/", options: &ListOptions{Recursive: true}, paging: &Paging{First: 5, After: "/folder2/c"}},
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
							Contents: &[]byte{},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folder1/file-inner.jpg",
							Contents: &[]byte{},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folderX/folderZ/file.txt",
							Contents: &[]byte{},
						},
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/folderA/folderB/file.txt",
							Contents: &[]byte{},
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
							Contents:   &pngImage,
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
							Contents: &emptyFileBytes,
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
							Contents:   &pngImage,
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
							Contents:   &emptyFileBytes,
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
							Contents:   &emptyFileBytes,
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
							fContents(emptyFileBytes),
						),
					},
					cmdUpsert{
						cmd: UpsertFileCommand{
							Path:     "/file.png",
							Contents: &pngImage,
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
							Contents:   &emptyFileBytes,
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
							Contents:   &emptyFileBytes,
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
							Contents: &[]byte{},
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
							Contents: &[]byte{},
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
							Contents: &[]byte{},
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

	runTests(createListFoldersTests, t)
	runTests(createListFilesTests, t)
	runTests(createFileCRUDTests, t)
	runTests(createFolderCrudCases, t)
}
