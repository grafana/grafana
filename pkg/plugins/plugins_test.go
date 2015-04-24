package plugins

import (
	"path/filepath"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestPluginScans(t *testing.T) {

	Convey("When scaning for plugins", t, func() {
		path, _ := filepath.Abs("../../public/app/plugins")
		err := scan(path)

		So(err, ShouldBeNil)
		So(len(DataSources), ShouldBeGreaterThan, 1)
	})
}
