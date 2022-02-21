//go:build integration
// +build integration

package filestorage

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestLocalFsCdkBlobStorage(t *testing.T) {

	var filestorage FileStorage
	var ctx context.Context

	setup := func() {
		filestorage, _ = ProvideService(setting.NewCfg(), nil, "localfs")
		ctx = context.Background()
	}

	t.Run("Should be able to list folders", func(t *testing.T) {
		setup()
		folders, err := filestorage.ListFolders(ctx, "/")
		require.NoError(t, err)
		require.Equal(t, []FileMetadata{
			{
				Name:     "folderA",
				FullPath: "/folderA",
			},
			{
				Name:     "folderAnestedA",
				FullPath: "/folderA/folderAnestedA",
			},
		}, folders)

		folders, err = filestorage.ListFolders(ctx, "/folderA")
		require.NoError(t, err)
		require.Equal(t, []FileMetadata{
			{
				Name:     "folderAnestedA",
				FullPath: "/folderA/folderAnestedA",
			},
		}, folders)

	})

	t.Run("Should be able to list files", func(t *testing.T) {
		setup()
		res, err := filestorage.ListFiles(ctx, "/", true, nil)
		require.NoError(t, err)

		require.Equal(t, []NameFullPath{
			{Name: "file.txt", FullPath: "/folderA/folderAnestedA/file.txt"},
			{Name: "rootFile.txt", FullPath: "/rootFile.txt"},
		}, extractNameFullPath(res.Files))
	})

	t.Run("should be able to read file", func(t *testing.T) {
		setup()
		path := "/folderA/folderAnestedA/file.txt"
		res, err := filestorage.Get(ctx, path)
		require.NoError(t, err)

		require.Equal(t, res.FullPath, path)
		require.Equal(t, res.Name, "file.txt")
		require.Equal(t, "content\n", string(res.Contents))
	})
}
