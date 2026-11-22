package store

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/filestorage"
)

func TestListPublicStaticIconsOnDisk(t *testing.T) {
	newTree := func(t *testing.T, withBuild bool) *nestedTree {
		root := t.TempDir()
		require.NoError(t, os.MkdirAll(filepath.Join(root, "img", "icons", "marker"), 0o750))
		require.NoError(t, os.WriteFile(filepath.Join(root, "img", "icons", "marker", "raw.svg"), []byte("<svg/>"), 0o600))
		if withBuild {
			require.NoError(t, os.MkdirAll(filepath.Join(root, "build", "img", "icons", "marker"), 0o750))
			require.NoError(t, os.WriteFile(filepath.Join(root, "build", "img", "icons", "marker", "built.svg"), []byte("<svg/>"), 0o600))
		}

		disk := newDiskStorage(RootStorageMeta{ReadOnly: true, Builtin: true}, RootStorageConfig{
			Prefix: RootPublicStatic,
			Name:   "Public static files",
			Disk: &StorageLocalDiskConfig{
				Path:  root,
				Roots: []string{"/img/", "/build/img/icons/"},
			},
		})
		tree := &nestedTree{
			rootsByOrgId:          map[int64][]storageRuntime{0: {disk}},
			initializeOrgStorages: func(int64) []storageRuntime { return nil },
		}
		tree.init()
		return tree
	}

	list := func(t *testing.T, tree *nestedTree, path string) []string {
		frame, err := tree.ListFolder(context.Background(), 0, path, 100, filestorage.NewAllowAllPathFilter())
		require.NoError(t, err)
		if frame == nil {
			return nil
		}
		var names []string
		for i := 0; i < frame.Rows(); i++ {
			names = append(names, frame.Fields[0].At(i).(string))
		}
		return names
	}

	t.Run("lists the build copy when present", func(t *testing.T) {
		names := list(t, newTree(t, true), RootPublicStatic+"/build/img/icons/marker")
		require.Equal(t, []string{"built.svg"}, names)
	})

	t.Run("build folder lists nothing when absent, raw copy still lists", func(t *testing.T) {
		tree := newTree(t, false)
		require.Empty(t, list(t, tree, RootPublicStatic+"/build/img/icons/marker"))
		require.Equal(t, []string{"raw.svg"}, list(t, tree, RootPublicStatic+"/img/icons/marker"))
	})
}
