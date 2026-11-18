package caching

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestGetDatasourceType(t *testing.T) {
	t.Parallel()

	require.Equal(t, "unknown", getDatasourceType(backend.PluginContext{}))
	require.Equal(t, "name", getDatasourceType(backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			Name: "name",
		},
	}))
}
