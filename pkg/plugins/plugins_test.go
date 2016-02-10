package plugins

import (
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ini.v1"
)

func TestPluginScans(t *testing.T) {

	Convey("When scaning for plugins", t, func() {
		setting.StaticRootPath, _ = filepath.Abs("../../public/")
		setting.Cfg = ini.Empty()
		err := Init()

		So(err, ShouldBeNil)
		So(len(DataSources), ShouldBeGreaterThan, 1)
		So(len(Panels), ShouldBeGreaterThan, 1)

		Convey("Should set module automatically", func() {
			So(DataSources["graphite"].Module, ShouldEqual, "app/plugins/datasource/graphite/module")
		})
	})

	Convey("When reading app plugin definition", t, func() {
		setting.Cfg = ini.Empty()
		sec, _ := setting.Cfg.NewSection("plugin.app-test")
		sec.NewKey("path", "../../tests/app-plugin-json")
		err := Init()

		So(err, ShouldBeNil)
		So(len(Apps), ShouldBeGreaterThan, 0)
		So(Apps["app-example"].Info.Logos.Large, ShouldEqual, "public/plugins/app-example/img/logo_large.png")
		So(Apps["app-example"].Info.Screenshots[1].Path, ShouldEqual, "public/plugins/app-example/img/screenshot2.png")
	})

}
