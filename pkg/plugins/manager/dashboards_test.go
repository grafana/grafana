package manager

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestGetPluginDashboards(t *testing.T) {
	cfg := &setting.Cfg{
		FeatureToggles: map[string]bool{},
		PluginSettings: setting.PluginSettings{
			"test-app": map[string]string{
				"path": "testdata/test-app",
			},
		},
	}
	pmCfg := plugins.FromGrafanaCfg(cfg)
	pm, err := ProvideService(cfg, nil, loader.New(pmCfg, nil,
		&signature.UnsignedPluginAuthorizer{Cfg: pmCfg}, &provider.Service{}), &sqlstore.SQLStore{})
	require.NoError(t, err)

	bus.AddHandler("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
		if query.Slug == "nginx-connections" {
			dash := models.NewDashboard("Nginx Connections")
			dash.Data.Set("revision", "1.1")
			query.Result = dash
			return nil
		}

		return models.ErrDashboardNotFound
	})

	bus.AddHandler("test", func(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error {
		var data = simplejson.New()
		data.Set("title", "Nginx Connections")
		data.Set("revision", 22)

		query.Result = []*models.Dashboard{
			{Slug: "nginx-connections", Data: data},
		}
		return nil
	})

	dashboards, err := pm.GetPluginDashboards(context.Background(), 1, "test-app")
	require.NoError(t, err)

	require.Len(t, dashboards, 2)
	require.Equal(t, "Nginx Connections", dashboards[0].Title)
	require.Equal(t, int64(25), dashboards[0].Revision)
	require.Equal(t, int64(22), dashboards[0].ImportedRevision)
	require.Equal(t, "db/nginx-connections", dashboards[0].ImportedUri)

	require.Equal(t, int64(2), dashboards[1].Revision)
	require.Equal(t, int64(0), dashboards[1].ImportedRevision)
}
