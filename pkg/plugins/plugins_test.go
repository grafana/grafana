package plugins

import (
	"context"
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
		err := initPlugins(context.Background())

		So(err, ShouldBeNil)
		So(len(DataSources), ShouldBeGreaterThan, 1)
		So(len(Panels), ShouldBeGreaterThan, 1)

		Convey("Should set module automatically", func() {
			So(DataSources["graphite"].Module, ShouldEqual, "app/plugins/datasource/graphite/module")
		})
	})

	Convey("When reading app plugin definition", t, func() {
		setting.Cfg = ini.Empty()
		sec, _ := setting.Cfg.NewSection("plugin.nginx-app")
		sec.NewKey("path", "../../tests/test-app")
		err := initPlugins(context.Background())

		So(err, ShouldBeNil)
		So(len(Apps), ShouldBeGreaterThan, 0)

		So(Apps["test-app"].Info.Logos.Large, ShouldEqual, "public/plugins/test-app/img/logo_large.png")
		So(Apps["test-app"].Info.Screenshots[1].Path, ShouldEqual, "public/plugins/test-app/img/screenshot2.png")
	})

}
