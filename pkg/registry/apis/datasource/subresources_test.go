package datasource

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/plugins"
)

func TestGetSubresourceStorage(t *testing.T) {
	for _, tc := range []struct {
		name   string
		cfg    DataSourceAPIBuilderConfig
		routes []*plugins.Route
		want   []string
	}{
		{name: "query only", want: []string{"query"}},
		{name: "proxy needs plugin routes", cfg: DataSourceAPIBuilderConfig{EnableProxyEndpoint: true}, want: []string{"query"}},
		{name: "execution endpoints", cfg: DataSourceAPIBuilderConfig{EnableHealthEndpoint: true, EnableResourceEndpoint: true, EnableProxyEndpoint: true},
			routes: []*plugins.Route{{Method: "GET", Path: "api"}}, want: []string{"query", "health", "resources", "proxy"}},
		{name: "access requires configuration storage", cfg: DataSourceAPIBuilderConfig{UseDualWriter: true}, want: []string{"query", "access"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b := &DataSourceAPIBuilder{cfg: tc.cfg, pluginJSON: plugins.JSONData{Routes: tc.routes}}
			storage := b.GetSubresourceStorage()
			names := make([]string, 0, len(storage))
			for name, endpoint := range storage {
				names = append(names, name)
				_, ok := endpoint.(rest.Connecter)
				require.True(t, ok)
				endpoint.Destroy()
			}
			require.ElementsMatch(t, tc.want, names)
		})
	}
}
