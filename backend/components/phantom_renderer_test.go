package components

import (
	"io/ioutil"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestPhantomRender(t *testing.T) {

	Convey("Can render url", func() {
		tempDir, _ := ioutil.TempDir("", "img")
		renderer := &PhantomRenderer{ImagesDir: tempDir}
		renderer.Render("http://www.google.com")
		//So(err, ShouldBeNil)

		//_, err = os.Stat(store.getFilePathForDashboard("hello"))
		//So(err, ShouldBeNil)
	})

}
