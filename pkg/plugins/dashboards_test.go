package plugins

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestPluginDashboards(t *testing.T) {
	Convey("When asking plugin dashboard info", t, func() {
		pm := &PluginManager{
			Cfg: &setting.Cfg{
				FeatureToggles: map[string]bool{},
				PluginSettings: setting.PluginSettings{
					"test-app": map[string]string{
						"path": "testdata/test-app",
					},
				},
			},
		}
		err := pm.Init()
		So(err, ShouldBeNil)

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

		dashboards, err := GetPluginDashboards(1, "test-app")

		So(err, ShouldBeNil)

		Convey("should return 2 dashboarrd", func() {
			So(len(dashboards), ShouldEqual, 2)
		})

		Convey("should include installed version info", func() {
			So(dashboards[0].Title, ShouldEqual, "Nginx Connections")
			So(dashboards[0].Revision, ShouldEqual, 25)
			So(dashboards[0].ImportedRevision, ShouldEqual, 22)
			So(dashboards[0].ImportedUri, ShouldEqual, "db/nginx-connections")

			So(dashboards[1].Revision, ShouldEqual, 2)
			So(dashboards[1].ImportedRevision, ShouldEqual, 0)
		})
	})

}
