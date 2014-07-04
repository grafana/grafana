package stores

import (
	. "github.com/smartystreets/goconvey/convey"
	"github.com/torkelo/grafana-pro/backend/models"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
)

func TestFileStore(t *testing.T) {
	tempDir, err := ioutil.TempDir("", "store")
	dashDir := filepath.Join(tempDir, "dashboards")
	defer os.RemoveAll(tempDir)

	store := newFileStore(tempDir)

	Convey("When saving a dashboard", t, func() {

		dashboard := &models.Dashboard{}

		err = store.Save(dashboard)

		Convey("should be saved to disk", func() {
			So(err, ShouldBeNil)

			savedPath := filepath.Join(dashDir, "hello")
			_, err = os.Stat(savedPath)
			So(err, ShouldBeNil)
		})

	})

	Convey("When getting a saved dashboard", t, func() {
		source, _ := filepath.Abs("../../data/dashboards/default.json")
		dest := filepath.Join(dashDir, "default.json")
		copyFile(dest, source)

		dash, err := store.GetById("default")

		Convey("should be read from disk", func() {
			So(err, ShouldBeNil)
			So(dash, ShouldNotBeNil)

			So(dash.Title(), ShouldEqual, "Welcome to Grafana!")
		})

	})

}

func copyFile(dst, src string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	cerr := out.Close()
	if err != nil {
		return err
	}
	return cerr
}
