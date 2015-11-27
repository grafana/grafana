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
	})
}
