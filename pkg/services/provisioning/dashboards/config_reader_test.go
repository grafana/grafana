package dashboards

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

var (
	simpleDashboardConfig string = "./test-configs/dashboards-from-disk"
	brokenConfigs         string = "./test-configs/broken-configs"
)

func TestDashboardsAsConfig(t *testing.T) {
	Convey("Dashboards as configuration", t, func() {

		Convey("Can read config file", func() {

			cfgProvifer := configReader{path: simpleDashboardConfig}
			cfg, err := cfgProvifer.readConfig()
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			So(len(cfg), ShouldEqual, 2)

			ds := cfg[0]

			So(ds.Name, ShouldEqual, "general dashboards")
			So(ds.Type, ShouldEqual, "file")
			So(ds.OrgId, ShouldEqual, 2)
			So(ds.Folder, ShouldEqual, "developers")
			So(ds.Editable, ShouldBeTrue)

			So(len(ds.Options), ShouldEqual, 1)
			So(ds.Options["folder"], ShouldEqual, "/var/lib/grafana/dashboards")

			ds2 := cfg[1]

			So(ds2.Name, ShouldEqual, "default")
			So(ds2.Type, ShouldEqual, "file")
			So(ds2.OrgId, ShouldEqual, 1)
			So(ds2.Folder, ShouldEqual, "")
			So(ds2.Editable, ShouldBeFalse)

			So(len(ds2.Options), ShouldEqual, 1)
			So(ds2.Options["folder"], ShouldEqual, "/var/lib/grafana/dashboards")
		})

		Convey("Should skip broken config files", func() {

			cfgProvifer := configReader{path: brokenConfigs}
			cfg, err := cfgProvifer.readConfig()
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			So(len(cfg), ShouldEqual, 0)

		})
	})
}
