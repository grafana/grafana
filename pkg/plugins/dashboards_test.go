package plugins

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ini.v1"
)

func TestPluginDashboards(t *testing.T) {

	Convey("When asking plugin dashboard info", t, func() {
		setting.Cfg = ini.Empty()
		sec, _ := setting.Cfg.NewSection("plugin.test-app")
		sec.NewKey("path", "../../tests/test-app")
		err := Init()

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

		dashboards, err := GetPluginDashboards(1, "test-app")

		So(err, ShouldBeNil)

		Convey("should return 2 dashboarrd", func() {
			So(len(dashboards), ShouldEqual, 2)
		})

		Convey("should include installed version info", func() {
			So(dashboards[0].Title, ShouldEqual, "Nginx Connections")
			//So(dashboards[0].Revision, ShouldEqual, "1.5")
			//So(dashboards[0].InstalledRevision, ShouldEqual, "1.1")
			//So(dashboards[0].InstalledUri, ShouldEqual, "db/nginx-connections")

			//So(dashboards[1].Revision, ShouldEqual, "2.0")
			//So(dashboards[1].InstalledRevision, ShouldEqual, "")
		})
	})

}
