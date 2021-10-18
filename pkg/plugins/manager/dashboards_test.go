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
	setting.BuildVersion = "8.2.1-beta.2"
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
		query.Result = []*models.Dashboard{
			{Uid: "1MHHlVjzz", Slug: "nginx-connections", Data: simplejson.NewFromAny(map[string]interface{}{"title": "Nginx Connections", "revision": 22})},
			{Uid: "2VXHlVjll", Slug: "nginx-memory-incompatible", Data: simplejson.NewFromAny(map[string]interface{}{"title": "Nginx Memory - Incompatible", "revision": 21})},
		}
		return nil
	})

	dashboards, err := pm.GetPluginDashboards(1, "test-app")
	require.NoError(t, err)

	//incompatible versions will be ignored except those already loaded
	require.Len(t, dashboards, 5)
	require.Equal(t, "Nginx Connections", dashboards[0].Title)
	require.Equal(t, int64(25), dashboards[0].Revision)
	require.Equal(t, int64(22), dashboards[0].ImportedRevision)
	require.Equal(t, "db/nginx-connections", dashboards[0].ImportedUri)
	require.True(t, dashboards[0].Compatible)

	require.Equal(t, int64(2), dashboards[1].Revision)
	require.Equal(t, int64(0), dashboards[1].ImportedRevision)
	require.True(t, dashboards[1].Compatible)

	require.Equal(t, "Nginx Connections - Latest", dashboards[2].Title)
	require.Equal(t, int64(25), dashboards[2].Revision)
	require.True(t, dashboards[2].Compatible)

	require.Equal(t, "Nginx Memory - Incompatible", dashboards[3].Title)
	require.False(t, dashboards[3].Compatible)
}
