package datasources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func TestCanonicalPluginType(t *testing.T) {
	pluginStore := pluginstore.NewFakePluginStore(pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:       "grafana-pyroscope-datasource",
			AliasIDs: []string{"phlare"},
		},
	}, pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:       "grafana-testdata-datasource",
			AliasIDs: []string{"testdata"},
		},
	})
	ctx := context.Background()

	tests := []struct {
		name        string
		pluginStore pluginstore.Store
		typeOrAlias string
		want        string
	}{
		{
			name:        "returns canonical ID for alias",
			pluginStore: pluginStore,
			typeOrAlias: "phlare",
			want:        "grafana-pyroscope-datasource",
		},
		{
			name:        "returns canonical ID when already canonical",
			pluginStore: pluginStore,
			typeOrAlias: "grafana-pyroscope-datasource",
			want:        "grafana-pyroscope-datasource",
		},
		{
			name:        "returns testdata canonical ID for alias",
			pluginStore: pluginStore,
			typeOrAlias: "testdata",
			want:        "grafana-testdata-datasource",
		},
		{
			name:        "returns input unchanged for unknown type",
			pluginStore: pluginStore,
			typeOrAlias: "does-not-exist",
			want:        "does-not-exist",
		},
		{
			name:        "returns input unchanged when plugin store is nil",
			pluginStore: nil,
			typeOrAlias: "phlare",
			want:        "phlare",
		},
		{
			name:        "returns input unchanged when plugin store is empty",
			pluginStore: pluginstore.NewFakePluginStore(),
			typeOrAlias: "phlare",
			want:        "phlare",
		},
		{
			name:        "returns empty string unchanged",
			pluginStore: pluginStore,
			typeOrAlias: "",
			want:        "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CanonicalPluginType(ctx, tt.pluginStore, tt.typeOrAlias)
			assert.Equal(t, tt.want, got)
		})
	}
}
