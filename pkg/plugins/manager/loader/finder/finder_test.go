package finder

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFinder_Find(t *testing.T) {
	testCases := []struct {
		name               string
		pluginDirs         []string
		expectedPathSuffix []string
		err                error
	}{
		{
			name:               "Dir with single plugin",
			pluginDirs:         []string{"../../testdata/valid-v2-signature"},
			expectedPathSuffix: []string{"/pkg/plugins/manager/testdata/valid-v2-signature/plugin/plugin.json"},
		},
		{
			name:       "Dir with nested plugins",
			pluginDirs: []string{"../../testdata/duplicate-plugins"},
			expectedPathSuffix: []string{
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/nested/plugin.json",
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/plugin.json",
			},
		},
		{
			name:               "Dir with single plugin which has symbolic link root directory",
			pluginDirs:         []string{"../../testdata/symbolic-plugin-dirs"},
			expectedPathSuffix: []string{"/pkg/plugins/manager/testdata/includes-symlinks/plugin.json"},
		},
		{
			name:       "Multiple plugin dirs",
			pluginDirs: []string{"../../testdata/duplicate-plugins", "../../testdata/invalid-v1-signature"},
			expectedPathSuffix: []string{
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/nested/plugin.json",
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/plugin.json",
				"/pkg/plugins/manager/testdata/invalid-v1-signature/plugin/plugin.json"},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			f := New()
			pluginPaths, err := f.Find(tc.pluginDirs)
			if (err != nil) && !errors.Is(err, tc.err) {
				t.Errorf("Find() error = %v, expected error %v", err, tc.err)
				return
			}

			assert.Equal(t, len(tc.expectedPathSuffix), len(pluginPaths))
			for i := 0; i < len(tc.expectedPathSuffix); i++ {
				assert.True(t, strings.HasSuffix(pluginPaths[i], tc.expectedPathSuffix[i]))
			}
		})
	}
}

func TestFinder_getAbsPluginJSONPaths(t *testing.T) {
	t.Run("When scanning a folder that doesn't exists shouldn't return an error", func(t *testing.T) {
		origWalk := walk
		walk = func(path string, followSymlinks, detectSymlinkInfiniteLoop bool, walkFn util.WalkFunc) error {
			return walkFn(path, nil, os.ErrNotExist)
		}
		t.Cleanup(func() {
			walk = origWalk
		})

		finder := &Finder{
			log: log.New(),
		}

		paths, err := finder.getAbsPluginJSONPaths("test")
		require.NoError(t, err)
		require.Empty(t, paths)
	})

	t.Run("When scanning a folder that lacks permission shouldn't return an error", func(t *testing.T) {
		origWalk := walk
		walk = func(path string, followSymlinks, detectSymlinkInfiniteLoop bool, walkFn util.WalkFunc) error {
			return walkFn(path, nil, os.ErrPermission)
		}
		t.Cleanup(func() {
			walk = origWalk
		})

		finder := &Finder{
			log: log.New(),
		}

		paths, err := finder.getAbsPluginJSONPaths("test")
		require.NoError(t, err)
		require.Empty(t, paths)
	})

	t.Run("When scanning a folder that returns a non-handled error should return that error", func(t *testing.T) {
		origWalk := walk
		walk = func(path string, followSymlinks, detectSymlinkInfiniteLoop bool, walkFn util.WalkFunc) error {
			return walkFn(path, nil, fmt.Errorf("random error"))
		}
		t.Cleanup(func() {
			walk = origWalk
		})

		finder := &Finder{
			log: log.New(),
		}

		paths, err := finder.getAbsPluginJSONPaths("test")
		require.Error(t, err)
		require.Empty(t, paths)
	})
}
