package setting

import (
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
		})
	})
}
