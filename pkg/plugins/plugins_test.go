package plugins

import (
	"path/filepath"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestPluginScans(t *testing.T) {

	Convey("When scaning for plugins", t, func() {
		path, _ := filepath.Abs("../../src/app/plugins")
		err := Scan(path)

		So(err, ShouldBeNil)
		So(len(List), ShouldEqual, 1)
	})
}
