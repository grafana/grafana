package plugins

import (
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestPluginScans(t *testing.T) {

	Convey("When scaning for plugins", t, func() {
		setting.StaticRootPath = filepath.Abs("../../public/")
		err := Init()

		So(err, ShouldBeNil)
		So(len(DataSources), ShouldBeGreaterThan, 1)
	})
}
