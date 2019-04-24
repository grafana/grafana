package plugins

import (
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ini.v1"
)

func TestPluginScans(t *testing.T) {

	Convey("When scanning for plugins", t, func() {
		setting.StaticRootPath, _ = filepath.Abs("../../public/")
		setting.Raw = ini.Empty()

		pm := &PluginManager{}
		err := pm.Init()

		So(err, ShouldBeNil)
		So(len(DataSources), ShouldBeGreaterThan, 1)
		So(len(Panels), ShouldBeGreaterThan, 1)

		Convey("Should set module automatically", func() {
			So(DataSources["graphite"].Module, ShouldEqual, "app/plugins/datasource/graphite/module")
		})
	})

	Convey("When reading app plugin definition", t, func() {
		setting.Raw = ini.Empty()
		sec, _ := setting.Raw.NewSection("plugin.nginx-app")
		sec.NewKey("path", "testdata/test-app")

		pm := &PluginManager{}
		err := pm.Init()

		So(err, ShouldBeNil)
		So(len(Apps), ShouldBeGreaterThan, 0)

		So(Apps["test-app"].Info.Logos.Large, ShouldEqual, "public/plugins/test-app/img/logo_large.png")
		So(Apps["test-app"].Info.Screenshots[1].Path, ShouldEqual, "public/plugins/test-app/img/screenshot2.png")
	})

}
