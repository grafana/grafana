//go:build integration
// +build integration

package filestorage

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
	"gocloud.dev/blob"
)

type NameFullPath struct {
	Name     string
	FullPath string
}

func extractNameFullPath(meta []FileMetadata) []NameFullPath {
	resp := make([]NameFullPath, 0)
	for i := range meta {
		resp = append(resp, NameFullPath{
			Name:     meta[i].Name,
			FullPath: meta[i].FullPath,
		})
	}
	return resp
}

func TestSqlStorage(t *testing.T) {

	var sqlStore *sqlstore.SQLStore
	var filestorage FileStorage
	var ctx context.Context

	setup := func() {
		mode := "db"
		testLogger := log.New("testStorageLogger")
		if mode == "db" {
			sqlStore = sqlstore.InitTestDB(t)
			filestorage = wrapper{
				log: testLogger,
				wrapped: dbFileStorage{
					db:  sqlStore,
					log: testLogger,
				},
			}
		} else if mode == "mem" {
			bucket, _ := blob.OpenBucket(context.Background(), "mem://")
			filestorage = wrapper{
				log: testLogger,
				wrapped: &cdkBlobStorage{
					log:        testLogger,
					bucket:     bucket,
					rootFolder: Delimiter,
				},
			}
		}

		ctx = context.Background()
	}

	t.Run("Should be able to insert a file", func(t *testing.T) {
		setup()
		err := filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folder1/folder2/file.jpg",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		require.NoError(t, err)
	})

	t.Run("Should be able to get a file", func(t *testing.T) {
		setup()
		path := "/folder1/folder2/file.jpg"
		properties := map[string]string{"prop1": "val1", "prop2": "val"}
		err := filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       path,
			Contents:   &[]byte{},
			Properties: properties,
		})
		require.NoError(t, err)

		file, err := filestorage.Get(ctx, path)
		require.NoError(t, err)

		require.Equal(t, path, file.FullPath)
		require.Equal(t, "file.jpg", file.Name)
		require.Equal(t, properties, file.Properties)
	})

	t.Run("Should not be able to get a non-existent file", func(t *testing.T) {
		setup()
		path := "/folder1/folder2/file.jpg"

		file, err := filestorage.Get(ctx, path)
		require.NoError(t, err)
		require.Nil(t, file)
	})

	t.Run("Should be able to list files", func(t *testing.T) {
		setup()
		err := filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folder1/folder2/file.jpg",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		require.NoError(t, err)

		err = filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folder1/file-inner.jpg",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		require.NoError(t, err)

		resp, err := filestorage.ListFiles(ctx, "/folder1", nil, &ListOptions{Recursive: true})
		require.NoError(t, err)

		require.Equal(t, []NameFullPath{
			{
				Name:     "file-inner.jpg",
				FullPath: "/folder1/file-inner.jpg",
			},
			{
				Name:     "file.jpg",
				FullPath: "/folder1/folder2/file.jpg",
			},
		}, extractNameFullPath(resp.Files))

		resp, err = filestorage.ListFiles(ctx, "/folder1", nil, nil)
		require.NoError(t, err)

		require.Equal(t, []NameFullPath{
			{
				Name:     "file-inner.jpg",
				FullPath: "/folder1/file-inner.jpg",
			},
		}, extractNameFullPath(resp.Files))

		resp, err = filestorage.ListFiles(ctx, "/folder1/folder2", nil, nil)
		require.NoError(t, err)

		require.Equal(t, []NameFullPath{
			{
				Name:     "file.jpg",
				FullPath: "/folder1/folder2/file.jpg",
			},
		}, extractNameFullPath(resp.Files))
	})

	t.Run("Should be able to list files with prefix filtering", func(t *testing.T) {
		setup()
		err := filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folder1/folder2/file.jpg",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		require.NoError(t, err)

		err = filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folder1/file-inner.jpg",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		require.NoError(t, err)

		resp, err := filestorage.ListFiles(ctx, "/folder1", nil, &ListOptions{
			Recursive: true, PathFilters: PathFilters{
				allowedPrefixes: []string{"/folder2"},
			},
		})
		require.NoError(t, err)

		require.Equal(t, []NameFullPath{}, extractNameFullPath(resp.Files))

		resp, err = filestorage.ListFiles(ctx, "/folder1", nil, &ListOptions{
			Recursive: true, PathFilters: PathFilters{
				allowedPrefixes: []string{"/folder1/folde"},
			},
		})
		require.NoError(t, err)

		require.Equal(t, []NameFullPath{
			{
				Name:     "file.jpg",
				FullPath: "/folder1/folder2/file.jpg",
			},
		}, extractNameFullPath(resp.Files))
	})

	t.Run("Should be able to list files with pagination", func(t *testing.T) {
		setup()
		err := filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folder1/folder2/file.jpg",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		require.NoError(t, err)

		err = filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folder1/file-inner.jpg",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		require.NoError(t, err)
		filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folderA/folderB/file.txt",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})

		resp, err := filestorage.ListFiles(ctx, "/", &Paging{
			After: "/folder1/file-inner.jpg",
			First: 1,
		}, &ListOptions{Recursive: true})
		require.NoError(t, err)

		require.Equal(t, []NameFullPath{
			{Name: "file.jpg", FullPath: "/folder1/folder2/file.jpg"},
		}, extractNameFullPath(resp.Files))
	})

	t.Run("Should be able to list folders", func(t *testing.T) {
		setup()
		filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folder1/folder2/file.jpg",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folder1/file-inner.jpg",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folderX/folderZ/file.txt",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folderA/folderB/file.txt",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})

		resp, err := filestorage.ListFolders(ctx, "/", nil)
		require.NoError(t, err)

		require.Equal(t, []FileMetadata{
			{
				Name:     "folder1",
				FullPath: "/folder1",
			},
			{
				Name:     "folder2",
				FullPath: "/folder1/folder2",
			},
			{
				Name:     "folderA",
				FullPath: "/folderA",
			}, {
				Name:     "folderB",
				FullPath: "/folderA/folderB",
			},
			{
				Name:     "folderX",
				FullPath: "/folderX",
			}, {
				Name:     "folderZ",
				FullPath: "/folderX/folderZ",
			},
		}, resp)
	})

	t.Run("Should be able to create and delete folders", func(t *testing.T) {
		setup()
		filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folder1/folder2/file.jpg",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		filestorage.CreateFolder(ctx, "/folder/dashboards", "myNewFolder")
		filestorage.CreateFolder(ctx, "/folder/icons", "emojis")
		err := filestorage.DeleteFolder(ctx, "/folder/dashboards/myNewFolder")
		require.NoError(t, err)

		resp, err := filestorage.ListFolders(ctx, "/", nil)
		require.NoError(t, err)

		require.Equal(t, []FileMetadata{
			{
				Name:     "folder",
				FullPath: "/folder",
			}, {
				Name:     "icons",
				FullPath: "/folder/icons",
			},
			{
				Name:     "emojis",
				FullPath: "/folder/icons/emojis",
			}, {
				Name:     "folder1",
				FullPath: "/folder1",
			},
			{
				Name:     "folder2",
				FullPath: "/folder1/folder2",
			},
		}, resp)
	})

	t.Run("Should not be able to delete folders with files", func(t *testing.T) {
		setup()
		filestorage.CreateFolder(ctx, "/folder/dashboards", "myNewFolder")
		filestorage.Upsert(ctx, &UpsertFileCommand{
			Path:       "/folder/dashboards/myNewFolder/file.jpg",
			Contents:   &[]byte{},
			Properties: map[string]string{"prop1": "val1", "prop2": "val"},
		})
		filestorage.DeleteFolder(ctx, "/folder/dashboards/myNewFolder")

		resp, err := filestorage.ListFolders(ctx, "/", nil)
		require.NoError(t, err)

		require.Equal(t, []FileMetadata{
			{
				Name:     "folder",
				FullPath: "/folder",
			}, {
				Name:     "dashboards",
				FullPath: "/folder/dashboards",
			},
			{
				Name:     "myNewFolder",
				FullPath: "/folder/dashboards/myNewFolder",
			},
		}, resp)

		files, err := filestorage.ListFiles(ctx, "/", nil, &ListOptions{Recursive: true})
		require.NoError(t, err)
		require.Equal(t, []NameFullPath{
			{
				Name:     "file.jpg",
				FullPath: "/folder/dashboards/myNewFolder/file.jpg",
			},
		}, extractNameFullPath(files.Files))
	})
}
