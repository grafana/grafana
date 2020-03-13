package plugins

import (
	"io/ioutil"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ini.v1"
)

func TestDashboardImport(t *testing.T) {
	pluginScenario("When importing a plugin dashboard", t, func() {
		origNewDashboardService := dashboards.NewService
		mock := &dashboards.FakeDashboardService{}
		dashboards.MockDashboardService(mock)

		cmd := ImportDashboardCommand{
			PluginId: "test-app",
			Path:     "dashboards/connections.json",
			OrgId:    1,
			User:     &models.SignedInUser{UserId: 1, OrgRole: models.ROLE_ADMIN},
			Inputs: []ImportDashboardInput{
				{Name: "*", Type: "datasource", Value: "graphite"},
			},
		}

		err := ImportDashboard(&cmd)
		So(err, ShouldBeNil)

		Convey("should install dashboard", func() {
			So(cmd.Result, ShouldNotBeNil)

			resultStr, _ := mock.SavedDashboards[0].Dashboard.Data.EncodePretty()
			expectedBytes, _ := ioutil.ReadFile("testdata/test-app/dashboards/connections_result.json")
			expectedJson, _ := simplejson.NewJson(expectedBytes)
			expectedStr, _ := expectedJson.EncodePretty()

			So(string(resultStr), ShouldEqual, string(expectedStr))

			panel := mock.SavedDashboards[0].Dashboard.Data.Get("rows").GetIndex(0).Get("panels").GetIndex(0)
			So(panel.Get("datasource").MustString(), ShouldEqual, "graphite")
		})

		Reset(func() {
			dashboards.NewService = origNewDashboardService
		})
	})

	Convey("When evaling dashboard template", t, func() {
		template, _ := simplejson.NewJson([]byte(`{
		"__inputs": [
			{
						"name": "DS_NAME",
			"type": "datasource"
			}
		],
		"test": {
			"prop": "${DS_NAME}"
		}
		}`))

		evaluator := &DashTemplateEvaluator{
			template: template,
			inputs: []ImportDashboardInput{
				{Name: "*", Type: "datasource", Value: "my-server"},
			},
		}

		res, err := evaluator.Eval()
		So(err, ShouldBeNil)

		Convey("should render template", func() {
			So(res.GetPath("test", "prop").MustString(), ShouldEqual, "my-server")
		})

		Convey("should not include inputs in output", func() {
			inputs := res.Get("__inputs")
			So(inputs.Interface(), ShouldBeNil)
		})

	})
}

func pluginScenario(desc string, t *testing.T, fn func()) {
	Convey("Given a plugin", t, func() {
		setting.Raw = ini.Empty()
		sec, _ := setting.Raw.NewSection("plugin.test-app")
		_, err := sec.NewKey("path", "testdata/test-app")
		So(err, ShouldBeNil)

		pm := &PluginManager{}
		err = pm.Init()
		So(err, ShouldBeNil)

		Convey(desc, fn)
	})
}
