package plugins

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ini.v1"
)

func TestPluginDashboards(t *testing.T) {

	Convey("When asking plugin dashboard info", t, func() {
		setting.Raw = ini.Empty()
		sec, _ := setting.Raw.NewSection("plugin.test-app")
		sec.NewKey("path", "../../tests/test-app")

		pm := &PluginManager{}
		err := pm.Init()

		So(err, ShouldBeNil)

		bus.AddHandler("test", func(query *m.GetDashboardQuery) error {
			if query.Slug == "nginx-connections" {
				dash := m.NewDashboard("Nginx Connections")
				dash.Data.Set("revision", "1.1")
				query.Result = dash
				return nil
			}

			return m.ErrDashboardNotFound
		})

		bus.AddHandler("test", func(query *m.GetDashboardsByPluginIdQuery) error {
			var data = simplejson.New()
			data.Set("title", "Nginx Connections")
			data.Set("revision", 22)

			query.Result = []*m.Dashboard{
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
