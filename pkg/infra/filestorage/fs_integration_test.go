//go:build integration
// +build integration

package filestorage

import (
	"context"
	"encoding/base64"
	"fmt"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"gocloud.dev/blob"
	"io/ioutil"
	"os"
	"testing"
)

const (
	pngImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAC4AAAAmCAYAAAC76qlaAAAABHNCSVQICAgIfAhkiAAAABl0RVh0U29mdHdhcmUAZ25vbWUtc2NyZWVuc2hvdO8Dvz4AAABFSURBVFiF7c5BDQAhEACx4/x7XjzwGELSKuiamfke9N8OnBKvidfEa+I18Zp4TbwmXhOvidfEa+I18Zp4TbwmXhOvidc2lcsESD1LGnUAAAAASUVORK5CYII="
)

func TestFsStorage(t *testing.T) {

	var testLogger log.Logger
	var sqlStore *sqlstore.SQLStore
	var filestorage FileStorage
	var ctx context.Context
	var tempDir string
	pngImage, _ := base64.StdEncoding.DecodeString(pngImageBase64)
	pngImageSize := int64(len(pngImage))

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
		filestorage = NewCdkBlobStorage(testLogger, bucket, Delimiter, nil)
	}

	setupSqlFS := func() {
		commonSetup()
		sqlStore = sqlstore.InitTestDB(t)
		filestorage = NewDbStorage(testLogger, sqlStore, nil)
	}

	setupLocalFs := func() {
		commonSetup()
		tmpDir, err := ioutil.TempDir("", "")
		tempDir = tmpDir
		if err != nil {
			t.Fatal(err)
		}

		bucket, err := blob.OpenBucket(context.Background(), "file://"+tmpDir)
		if err != nil {
			t.Fatal(err)
		}
		filestorage = NewCdkBlobStorage(testLogger, bucket, "", nil)
	}

	tests := []struct {
		name  string
		steps []interface{}
	}{
		{
			name: "inserting a file",
			steps: []interface{}{
				cmdUpsert{
					cmd: UpsertFileCommand{
						Path:       "/folder1/file.png",
						Contents:   &pngImage,
						Properties: map[string]string{"prop1": "val1", "prop2": "val"},
					},
				},
				queryGet{
					input: queryGetInput{
						path: "/folder1/file.png",
					},
					checks: checks(
						fName("file.png"),
						fMimeType("image/png"),
						fProperties(map[string]string{"prop1": "val1", "prop2": "val"}),
						fSize(pngImageSize),
						fContents(pngImage),
					),
				},
			},
		},
		{
			name: "getting a non-existent file",
			steps: []interface{}{
				queryGet{
					input: queryGetInput{
						path: "/folder1/file12412.png",
					},
				},
			},
		},
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
				queryListFiles{
					input: queryListFilesInput{path: "/folder1", options: &ListOptions{Recursive: true}},
					list:  checks(listSize(2), listHasMore(false), listLastPath("/folder1/folder2/file.jpg")),
					files: [][]interface{}{
						checks(fPath("/folder1/file-inner.jpg")),
						checks(fPath("/folder1/folder2/file.jpg")),
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
		{
			name: "creating and deleting folders",
			steps: []interface{}{
				cmdUpsert{
					cmd: UpsertFileCommand{
						Path:     "/folder1/folder2/file.jpg",
						Contents: &[]byte{},
					},
				},
				cmdCreateFolder{
					path: "/folder/dashboards",
					name: "myNewFolder",
				},
				cmdCreateFolder{
					path: "/folder/icons",
					name: "emojis",
				},
				queryListFolders{
					input: queryListFoldersInput{path: "/", options: &ListOptions{Recursive: true}},
					checks: [][]interface{}{
						checks(fPath("/folder")),
						checks(fPath("/folder/dashboards")),
						checks(fPath("/folder/dashboards/myNewFolder")),
						checks(fPath("/folder/icons")),
						checks(fPath("/folder/icons/emojis")),
						checks(fPath("/folder1")),
						checks(fPath("/folder1/folder2")),
					},
				},
				cmdDeleteFolder{
					path: "/folder/dashboards/myNewFolder",
				},
				queryListFolders{
					input: queryListFoldersInput{path: "/", options: &ListOptions{Recursive: true}},
					checks: [][]interface{}{
						checks(fPath("/folder")),
						checks(fPath("/folder/icons")),
						checks(fPath("/folder/icons/emojis")),
						checks(fPath("/folder1")),
						checks(fPath("/folder1/folder2")),
					},
				},
			},
		},
		{
			name: "should not be able to delete folders with files",
			steps: []interface{}{
				cmdCreateFolder{
					path: "/folder/dashboards",
					name: "myNewFolder",
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

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%s: %s", "IN MEM FS", tt.name), func(t *testing.T) {
			setupInMemFS()
			defer cleanUp()
			for i, step := range tt.steps {
				executeTestStep(t, ctx, step, i, filestorage)
			}
		})
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%s: %s", "SQL FS", tt.name), func(t *testing.T) {
			setupSqlFS()
			defer cleanUp()
			for i, step := range tt.steps {
				executeTestStep(t, ctx, step, i, filestorage)
			}
		})
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%s: %s", "Local FS", tt.name), func(t *testing.T) {
			if tt.name == "listing files with pagination" {
				// bug in cdk fileblob
				return
			}
			setupLocalFs()
			defer cleanUp()
			for i, step := range tt.steps {
				executeTestStep(t, ctx, step, i, filestorage)
			}
		})
	}
}
