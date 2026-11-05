package marketplacelicensing

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

func TestLicensePluginID(t *testing.T) {
	for _, tc := range []struct {
		name   string
		plugin *plugins.Plugin
		want   string
	}{
		{
			name:   "standalone plugin uses its own license",
			plugin: &plugins.Plugin{JSONData: plugins.JSONData{ID: "acme-datasource"}},
			want:   "acme-datasource",
		},
		{
			name: "nested plugin uses its parent's license",
			plugin: &plugins.Plugin{
				JSONData: plugins.JSONData{ID: "acme-datasource"},
				Parent:   &plugins.Plugin{JSONData: plugins.JSONData{ID: "acme-app"}},
			},
			want: "acme-app",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, LicensePluginID(tc.plugin))
		})
	}
}
