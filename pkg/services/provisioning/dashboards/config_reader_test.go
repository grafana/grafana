package dashboards

import (
	"testing"

	"github.com/grafana/grafana/pkg/log"
	. "github.com/smartystreets/goconvey/convey"
)

var (
	simpleDashboardConfig = "./testdata/test-configs/dashboards-from-disk"
	oldVersion            = "./testdata/test-configs/version-0"
	brokenConfigs         = "./testdata/test-configs/broken-configs"
)

func TestDashboardsAsConfig(t *testing.T) {
	Convey("Dashboards as configuration", t, func() {
		logger := log.New("test-logger")

		Convey("Can read config file version 1 format", func() {
			cfgProvider := configReader{path: simpleDashboardConfig, log: logger}
			cfg, err := cfgProvider.readConfig()
			So(err, ShouldBeNil)

			validateDashboardAsConfig(t, cfg)
		})

		Convey("Can read config file in version 0 format", func() {
			cfgProvider := configReader{path: oldVersion, log: logger}
			cfg, err := cfgProvider.readConfig()
			So(err, ShouldBeNil)

			validateDashboardAsConfig(t, cfg)
		})

		Convey("Should skip invalid path", func() {

			cfgProvider := configReader{path: "/invalid-directory", log: logger}
			cfg, err := cfgProvider.readConfig()
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			So(len(cfg), ShouldEqual, 0)
		})

		Convey("Should skip broken config files", func() {

			cfgProvider := configReader{path: brokenConfigs, log: logger}
			cfg, err := cfgProvider.readConfig()
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			So(len(cfg), ShouldEqual, 0)
		})
	})
}
func validateDashboardAsConfig(t *testing.T, cfg []*DashboardsAsConfig) {
	t.Helper()

	So(len(cfg), ShouldEqual, 2)

	ds := cfg[0]
	So(ds.Name, ShouldEqual, "general dashboards")
	So(ds.Type, ShouldEqual, "file")
	So(ds.OrgId, ShouldEqual, 2)
	So(ds.Folder, ShouldEqual, "developers")
	So(ds.Editable, ShouldBeTrue)
	So(len(ds.Options), ShouldEqual, 1)
	So(ds.Options["path"], ShouldEqual, "/var/lib/grafana/dashboards")
	So(ds.DisableDeletion, ShouldBeTrue)
	So(ds.UpdateIntervalSeconds, ShouldEqual, 15)

	ds2 := cfg[1]
	So(ds2.Name, ShouldEqual, "default")
	So(ds2.Type, ShouldEqual, "file")
	So(ds2.OrgId, ShouldEqual, 1)
	So(ds2.Folder, ShouldEqual, "")
	So(ds2.Editable, ShouldBeFalse)
	So(len(ds2.Options), ShouldEqual, 1)
	So(ds2.Options["path"], ShouldEqual, "/var/lib/grafana/dashboards")
	So(ds2.DisableDeletion, ShouldBeFalse)
	So(ds2.UpdateIntervalSeconds, ShouldEqual, 10)
}
