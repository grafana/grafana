package manager

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
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
	pm := newManager(cfg, &sqlstore.SQLStore{}, &fakeBackendPluginManager{})
	err := pm.init()
	require.NoError(t, err)

	bus.AddHandlerCtx("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
		if query.Slug == "nginx-connections" {
			dash := models.NewDashboard("Nginx Connections")
			dash.Data.Set("revision", "1.1")
			query.Result = dash
			return nil
		}

		return models.ErrDashboardNotFound
	})

	bus.AddHandlerCtx("test", func(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error {
		var data = simplejson.New()
		data.Set("title", "Nginx Connections")
		data.Set("revision", 22)

		query.Result = []*models.Dashboard{
			{Slug: "nginx-connections", Data: data},
		}
		return nil
	})

	dashboards, err := pm.GetPluginDashboards(1, "test-app")
	require.NoError(t, err)

	require.Len(t, dashboards, 2)
	require.Equal(t, "Nginx Connections", dashboards[0].Title)
	require.Equal(t, int64(25), dashboards[0].Revision)
	require.Equal(t, int64(22), dashboards[0].ImportedRevision)
	require.Equal(t, "db/nginx-connections", dashboards[0].ImportedUri)

	require.Equal(t, int64(2), dashboards[1].Revision)
	require.Equal(t, int64(0), dashboards[1].ImportedRevision)
}
