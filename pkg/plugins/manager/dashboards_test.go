package manager

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPluginDashboards(t *testing.T) {
	sqlStore := sqlstore.SQLStore{}
	backendPM := &fakeBackendPluginManager{}
	err := backendPM.Register("test-app", nil)
	require.NoError(t, err)

	pm := newManager(&setting.Cfg{
		FeatureToggles: map[string]bool{},
		PluginSettings: setting.PluginSettings{
			"test-app": map[string]string{
				"path": "testdata/test-app",
			},
		},
	}, &sqlStore, backendPM)
	pm.plugins["test-app"] = &plugins.PluginBase{}

	bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
		if query.Slug == "nginx-connections" {
			dash := models.NewDashboard("Nginx Connections")
			dash.Data.Set("revision", "1.1")
			query.Result = dash
			return nil
		}

		return models.ErrDashboardNotFound
	})

	bus.AddHandler("test", func(query *models.GetDashboardsByPluginIdQuery) error {
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

	assert.Len(t, dashboards, 2)
	assert.Equal(t, "Nginx Connections", dashboards[0].Title)
	assert.Equal(t, int64(25), dashboards[0].Revision)
	assert.Equal(t, int64(22), dashboards[0].ImportedRevision)
	assert.Equal(t, "db/nginx-connections", dashboards[0].ImportedUri)

	assert.Equal(t, int64(2), dashboards[1].Revision)
	assert.Equal(t, int64(0), dashboards[1].ImportedRevision)
}
