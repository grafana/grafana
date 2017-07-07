package plugins

import (
	"io/ioutil"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ini.v1"
)

func TestDashboardImport(t *testing.T) {

	Convey("When importing plugin dashboard", t, func() {
		setting.Cfg = ini.Empty()
		sec, _ := setting.Cfg.NewSection("plugin.test-app")
		sec.NewKey("path", "../../tests/test-app")
		err := Init()

		So(err, ShouldBeNil)

		var importedDash *m.Dashboard
		bus.AddHandler("test", func(cmd *m.SaveDashboardCommand) error {
			importedDash = cmd.GetDashboardModel()
			cmd.Result = importedDash
			return nil
		})

		cmd := ImportDashboardCommand{
			PluginId: "test-app",
			Path:     "dashboards/connections.json",
			OrgId:    1,
			UserId:   1,
			Inputs: []ImportDashboardInput{
				{Name: "*", Type: "datasource", Value: "graphite"},
			},
		}

		err = ImportDashboard(&cmd)
		So(err, ShouldBeNil)

		Convey("should install dashboard", func() {
			So(importedDash, ShouldNotBeNil)

			resultStr, _ := importedDash.Data.EncodePretty()
			expectedBytes, _ := ioutil.ReadFile("../../tests/test-app/dashboards/connections_result.json")
			expectedJson, _ := simplejson.NewJson(expectedBytes)
			expectedStr, _ := expectedJson.EncodePretty()

			So(string(resultStr), ShouldEqual, string(expectedStr))

			panel := importedDash.Data.Get("rows").GetIndex(0).Get("panels").GetIndex(0)
			So(panel.Get("datasource").MustString(), ShouldEqual, "graphite")
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
