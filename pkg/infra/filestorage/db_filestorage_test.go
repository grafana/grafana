//go:build integration
// +build integration

package filestorage

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
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
		sqlStore = sqlstore.InitTestDB(t)
		filestorage, _ = ProvideService(setting.NewCfg(), sqlStore)
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

		resp, err := filestorage.ListFiles(ctx, "/folder1", true, nil)
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
	})
}
