package finder

import (
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/setting"
)

func TestFinder_Find(t *testing.T) {
	testCases := []struct {
		name               string
		cfg                *setting.Cfg
		pluginDirs         []string
		expectedPathSuffix []string
		err                error
	}{
		{
			name:               "Dir with single plugin",
			cfg:                setting.NewCfg(),
			pluginDirs:         []string{"../../testdata/valid-v2-signature"},
			expectedPathSuffix: []string{"/pkg/plugins/manager/testdata/valid-v2-signature/plugin/plugin.json"},
		},
		{
			name:       "Dir with nested plugins",
			cfg:        setting.NewCfg(),
			pluginDirs: []string{"../../testdata/duplicate-plugins"},
			expectedPathSuffix: []string{
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/nested/plugin.json",
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/plugin.json",
			},
		},
		{
			name:               "Dir with single plugin which has symbolic link root directory",
			cfg:                setting.NewCfg(),
			pluginDirs:         []string{"../../testdata/symbolic-plugin-dirs"},
			expectedPathSuffix: []string{"/pkg/plugins/manager/testdata/includes-symlinks/plugin.json"},
		},
		{
			name:       "Multiple plugin dirs",
			cfg:        setting.NewCfg(),
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
