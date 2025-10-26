package pluginassets

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

func TestLocalProvider_Module(t *testing.T) {
	tests := []struct {
		name     string
		plugin   PluginInfo
		expected string
	}{
		{
			name: "core plugin without dist in base path should use core:plugin prefix",
			plugin: PluginInfo{
				JsonData: plugins.JSONData{ID: "grafana-testdata-datasource"},
				Class:    plugins.ClassCore,
				FS:       plugins.NewLocalFS("/grafana/plugins/grafana-testdata-datasource"),
			},
			expected: "core:plugin/grafana-testdata-datasource",
		},
		{
			name: "core plugin with dist in base path should use standard path",
			plugin: PluginInfo{
				JsonData: plugins.JSONData{ID: "grafana-testdata-datasource"},
				Class:    plugins.ClassCore,
				FS:       plugins.NewLocalFS("/grafana/plugins/grafana-testdata-datasource/dist"),
			},
			expected: "public/plugins/grafana-testdata-datasource/module.js",
		},
		{
			name: "external plugin should always use standard path",
			plugin: PluginInfo{
				JsonData: plugins.JSONData{ID: "external-plugin"},
				Class:    plugins.ClassExternal,
				FS:       plugins.NewLocalFS("/var/lib/grafana/plugins/external-plugin"),
			},
			expected: "public/plugins/external-plugin/module.js",
		},
		{
			name: "CDN plugin should use standard path",
			plugin: PluginInfo{
				JsonData: plugins.JSONData{ID: "cdn-plugin"},
				Class:    plugins.ClassCDN,
				FS:       plugins.NewLocalFS("/cdn/plugins/cdn-plugin"),
			},
			expected: "public/plugins/cdn-plugin/module.js",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &LocalProvider{}
			got, err := p.Module(tt.plugin)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, got)
		})
	}
}

func TestLocalProvider_AssetPath(t *testing.T) {
	tests := []struct {
		name      string
		plugin    PluginInfo
		assetPath []string
		expected  string
	}{
		{
			name: "single asset path",
			plugin: PluginInfo{
				JsonData: plugins.JSONData{ID: "test-plugin"},
			},
			assetPath: []string{"img/logo.svg"},
			expected:  "public/plugins/test-plugin/img/logo.svg",
		},
		{
			name: "multiple asset path segments",
			plugin: PluginInfo{
				JsonData: plugins.JSONData{ID: "test-plugin"},
			},
			assetPath: []string{"static", "img", "icon.png"},
			expected:  "public/plugins/test-plugin/static/img/icon.png",
		},
		{
			name: "empty asset path",
			plugin: PluginInfo{
				JsonData: plugins.JSONData{ID: "test-plugin"},
			},
			assetPath: []string{},
			expected:  "public/plugins/test-plugin",
		},
		{
			name: "asset path with special characters",
			plugin: PluginInfo{
				JsonData: plugins.JSONData{ID: "test-plugin"},
			},
			assetPath: []string{"dist/panel-options.json"},
			expected:  "public/plugins/test-plugin/dist/panel-options.json",
		},
		{
			name: "core plugin asset path",
			plugin: PluginInfo{
				JsonData: plugins.JSONData{ID: "grafana-testdata-datasource"},
				Class:    plugins.ClassCore,
			},
			assetPath: []string{"query-editor.js"},
			expected:  "public/plugins/grafana-testdata-datasource/query-editor.js",
		},
		{
			name: "deeply nested asset path",
			plugin: PluginInfo{
				JsonData: plugins.JSONData{ID: "test-plugin"},
			},
			assetPath: []string{"very", "deep", "nested", "path", "to", "file.js"},
			expected:  "public/plugins/test-plugin/very/deep/nested/path/to/file.js",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &LocalProvider{}
			got, err := p.AssetPath(tt.plugin, tt.assetPath...)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, got)
		})
	}
}
