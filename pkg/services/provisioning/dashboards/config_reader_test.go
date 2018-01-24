package dashboards

import (
	"testing"

	"github.com/grafana/grafana/pkg/log"
	. "github.com/smartystreets/goconvey/convey"
)

var (
	simpleDashboardConfig string = "./test-configs/dashboards-from-disk"
	brokenConfigs         string = "./test-configs/broken-configs"
)

func TestDashboardsAsConfig(t *testing.T) {
	Convey("Dashboards as configuration", t, func() {

		Convey("Can read config file", func() {

			cfgProvider := configReader{path: simpleDashboardConfig, log: log.New("test-logger")}
			cfg, err := cfgProvider.readConfig()
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
			So(ds.Options["path"], ShouldEqual, "/var/lib/grafana/dashboards")

			ds2 := cfg[1]

			So(ds2.Name, ShouldEqual, "default")
			So(ds2.Type, ShouldEqual, "file")
			So(ds2.OrgId, ShouldEqual, 1)
			So(ds2.Folder, ShouldEqual, "")
			So(ds2.Editable, ShouldBeFalse)

			So(len(ds2.Options), ShouldEqual, 1)
			So(ds2.Options["path"], ShouldEqual, "/var/lib/grafana/dashboards")
		})

		Convey("Should skip invalid path", func() {

			cfgProvider := configReader{path: "/invalid-directory", log: log.New("test-logger")}
			cfg, err := cfgProvider.readConfig()
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			So(len(cfg), ShouldEqual, 0)
		})

		Convey("Should skip broken config files", func() {

			cfgProvider := configReader{path: brokenConfigs, log: log.New("test-logger")}
			cfg, err := cfgProvider.readConfig()
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			So(len(cfg), ShouldEqual, 0)
		})
	})
}
