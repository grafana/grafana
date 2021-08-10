package manager

import (
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/infra/fs"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestFinder_Find(t *testing.T) {
	testCases := []struct {
		name               string
		cfg                *setting.Cfg
		pluginsDir         string
		expectedPathSuffix []string
		err                error
	}{
		{
			name:               "Dir with single plugin",
			cfg:                setting.NewCfg(),
			pluginsDir:         "./testdata/valid-v2-signature",
			expectedPathSuffix: []string{"/pkg/plugins/manager/testdata/valid-v2-signature/plugin/plugin.json"},
		},
		{
			name:       "Dir with nested plugins",
			cfg:        setting.NewCfg(),
			pluginsDir: "./testdata/duplicate-plugins",
			expectedPathSuffix: []string{
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/nested/plugin.json",
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/plugin.json",
			},
		},
		{
			name:               "Dir with single plugin which has symbolic link root directory",
			cfg:                setting.NewCfg(),
			pluginsDir:         "./testdata/symbolic-plugin-dirs",
			expectedPathSuffix: []string{"/pkg/plugins/manager/testdata/includes-symlinks/plugin.json"},
		},
		{
			name: "Dir with single plugin with extra plugin path defined in config",
			cfg: &setting.Cfg{
				PluginSettings: map[string]map[string]string{
					"plugin.datasource-id": {
						"path": "./testdata/duplicate-plugins",
					},
				},
			},
			pluginsDir: "./testdata/valid-v2-signature",
			expectedPathSuffix: []string{
				"/pkg/plugins/manager/testdata/valid-v2-signature/plugin/plugin.json",
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/nested/plugin.json",
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/plugin.json",
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			f := &Finder{
				Cfg: tc.cfg,
				log: &FakeLogger{},
			}
			pluginPaths, err := f.Find(tc.pluginsDir)
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

	t.Run("Supplied plugin directory will be created if doesn't already exist", func(t *testing.T) {
		f := &Finder{
			Cfg: setting.NewCfg(),
			log: &FakeLogger{},
		}

		nonExistingDir := "./nonExistingPluginsDir"
		exists, err := fs.Exists(nonExistingDir)
		assert.NoError(t, err)
		assert.False(t, exists)

		defer func() {
			assert.NoError(t, os.RemoveAll(nonExistingDir))
		}()
		pluginPaths, err := f.Find(nonExistingDir)
		assert.NoError(t, err)

		exists, err = fs.Exists(nonExistingDir)
		assert.NoError(t, err)
		assert.True(t, exists)

		assert.Empty(t, pluginPaths)
	})
}

type FakeLogger struct {
	log.Logger
}

func (fl *FakeLogger) Debug(string, ...interface{}) {
}

func (fl *FakeLogger) Info(string, ...interface{}) {
}

func (fl *FakeLogger) Warn(string, ...interface{}) {
}

func (fl *FakeLogger) Error(string, ...interface{}) {
}
