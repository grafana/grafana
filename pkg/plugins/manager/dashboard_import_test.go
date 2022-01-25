package manager

import (
	"context"
	"io/ioutil"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestDashboardImport(t *testing.T) {
	pluginScenario(t, "When importing a plugin dashboard", func(t *testing.T, pm *PluginManager) {
		origNewDashboardService := dashboards.NewService
		t.Cleanup(func() {
			dashboards.NewService = origNewDashboardService
		})
		mock := &dashboards.FakeDashboardService{}
		dashboards.MockDashboardService(mock)

		info, dash, err := pm.ImportDashboard(context.Background(), "test-app", "dashboards/connections.json", 1, 0, nil, false,
			[]plugins.ImportDashboardInput{
				{Name: "*", Type: "datasource", Value: "graphite"},
			}, &models.SignedInUser{UserId: 1, OrgRole: models.ROLE_ADMIN})
		require.NoError(t, err)
		require.NotNil(t, info)
		require.NotNil(t, dash)

		resultStr, err := mock.SavedDashboards[0].Dashboard.Data.EncodePretty()
		require.NoError(t, err)
		expectedBytes, err := ioutil.ReadFile("testdata/test-app/dashboards/connections_result.json")
		require.NoError(t, err)
		expectedJson, err := simplejson.NewJson(expectedBytes)
		require.NoError(t, err)
		expectedStr, err := expectedJson.EncodePretty()
		require.NoError(t, err)

		require.Equal(t, expectedStr, resultStr)

		panel := mock.SavedDashboards[0].Dashboard.Data.Get("rows").GetIndex(0).Get("panels").GetIndex(0)
		require.Equal(t, "graphite", panel.Get("datasource").MustString())
	})

	t.Run("When evaling dashboard template", func(t *testing.T) {
		template, err := simplejson.NewJson([]byte(`{
		"__inputs": [
			{
						"name": "DS_NAME",
			"type": "datasource"
			}
		],
		"test": {
			"prop": "${DS_NAME}_${DS_NAME}"
		}
		}`))
		require.NoError(t, err)

		evaluator := &DashTemplateEvaluator{
			template: template,
			inputs: []plugins.ImportDashboardInput{
				{Name: "*", Type: "datasource", Value: "my-server"},
			},
		}

		res, err := evaluator.Eval()
		require.NoError(t, err)

		require.Equal(t, "my-server_my-server", res.GetPath("test", "prop").MustString())

		inputs := res.Get("__inputs")
		require.Nil(t, inputs.Interface())
	})
}

func pluginScenario(t *testing.T, desc string, fn func(*testing.T, *PluginManager)) {
	t.Helper()

	t.Run("Given a plugin", func(t *testing.T) {
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

		t.Run(desc, func(t *testing.T) {
			fn(t, pm)
		})
	})
}
