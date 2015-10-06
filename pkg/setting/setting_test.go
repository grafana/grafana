package setting

import (
	"os"
	"path/filepath"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestLoadingSettings(t *testing.T) {

	Convey("Testing loading settings from ini file", t, func() {
		skipStaticRootValidation = true

		Convey("Given the default ini files", func() {
			err := NewConfigContext(&CommandLineArgs{HomePath: "../../"})
			So(err, ShouldBeNil)

			So(AdminUser, ShouldEqual, "admin")
		})

		Convey("Should be able to override via environment variables", func() {
			os.Setenv("GF_SECURITY_ADMIN_USER", "superduper")
			NewConfigContext(&CommandLineArgs{HomePath: "../../"})

			So(AdminUser, ShouldEqual, "superduper")
			So(DataPath, ShouldEqual, filepath.Join(HomePath, "data"))
			So(LogsPath, ShouldEqual, filepath.Join(DataPath, "log"))
		})

		Convey("Should get property map from command line args array", func() {
			props := getCommandLineProperties([]string{"cfg:test=value", "cfg:map.test=1"})

			So(len(props), ShouldEqual, 2)
			So(props["test"], ShouldEqual, "value")
			So(props["map.test"], ShouldEqual, "1")
		})

		Convey("Should be able to override via command line", func() {
			NewConfigContext(&CommandLineArgs{
				HomePath: "../../",
				Args:     []string{"cfg:paths.data=/tmp/data", "cfg:paths.logs=/tmp/logs"},
			})

			So(DataPath, ShouldEqual, "/tmp/data")
			So(LogsPath, ShouldEqual, "/tmp/logs")
		})

		Convey("Should be able to override defaults via command line", func() {
			NewConfigContext(&CommandLineArgs{
				HomePath: "../../",
				Args: []string{
					"cfg:default.server.domain=test2",
				},
				Config: filepath.Join(HomePath, "tests/config-files/override.ini"),
			})

			So(Domain, ShouldEqual, "test2")
		})

		Convey("Defaults can be overriden in specified config file", func() {
			NewConfigContext(&CommandLineArgs{
				HomePath: "../../",
				Config:   filepath.Join(HomePath, "tests/config-files/override.ini"),
				Args:     []string{"cfg:default.paths.data=/tmp/data"},
			})

			So(DataPath, ShouldEqual, "/tmp/override")
		})

		Convey("Command line overrides specified config file", func() {
			NewConfigContext(&CommandLineArgs{
				HomePath: "../../",
				Config:   filepath.Join(HomePath, "tests/config-files/override.ini"),
				Args:     []string{"cfg:paths.data=/tmp/data"},
			})

			So(DataPath, ShouldEqual, "/tmp/data")
		})

		Convey("Can use environment variables in config values", func() {
			os.Setenv("GF_DATA_PATH", "/tmp/env_override")
			NewConfigContext(&CommandLineArgs{
				HomePath: "../../",
				Args:     []string{"cfg:paths.data=${GF_DATA_PATH}"},
			})

			So(DataPath, ShouldEqual, "/tmp/env_override")
		})

	})
}
