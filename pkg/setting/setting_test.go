package setting

import (
	"os"
	"path/filepath"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestLoadingSettings(t *testing.T) {

	WorkDir, _ = filepath.Abs("../../")

	Convey("Testing loading settings from ini file", t, func() {

		Convey("Given the default ini files", func() {
			NewConfigContext()

			So(AppName, ShouldEqual, "Grafana")
			So(AdminUser, ShouldEqual, "admin")
		})

		Convey("Should be able to override via environment variables", func() {
			os.Setenv("GF_SECURITY_ADMIN_USER", "superduper")
			NewConfigContext()

			So(AdminUser, ShouldEqual, "superduper")
		})

	})
}
