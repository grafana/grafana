package stores

import (
	"fmt"
	. "github.com/smartystreets/goconvey/convey"
	"github.com/torkelo/grafana-pro/backend/models"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
)

func TestFileStore(t *testing.T) {

	GivenFileStore("When saving a dashboard", t, func(store *fileStore) {
		dashboard := models.NewDashboard("hello")

		err := store.Save(dashboard)

		Convey("should be saved to disk", func() {
			So(err, ShouldBeNil)

			_, err = os.Stat(store.getFilePathForDashboard("hello"))
			So(err, ShouldBeNil)
		})
	})

	GivenFileStore("When getting a saved dashboard", t, func(store *fileStore) {
		copyDashboardToTempData("default.json", store.dashDir)
		dash, err := store.GetById("default")

		Convey("should be read from disk", func() {
			So(err, ShouldBeNil)
			So(dash, ShouldNotBeNil)

			So(dash.Title(), ShouldEqual, "Grafana Play Home")
		})
	})

	GivenFileStore("When copying dashboards into data dir", t, func(store *fileStore) {
		copyDashboardToTempData("annotations.json", store.dashDir)
		copyDashboardToTempData("default.json", store.dashDir)
		copyDashboardToTempData("graph-styles.json", store.dashDir)
		store.scanFiles()

		Convey("should generate index of all dashboards", func() {
			result, err := store.Query("*")
			So(err, ShouldBeNil)
			So(len(result), ShouldEqual, 3)
		})
	})
}

func copyDashboardToTempData(name string, dir string) {
	source, _ := filepath.Abs("../../data/dashboards/" + name)
	dest := filepath.Join(dir, name)
	err := copyFile(dest, source)
	if err != nil {
		panic(fmt.Sprintf("failed to copy file %v", name))
	}
}

func GivenFileStore(desc string, t *testing.T, f func(store *fileStore)) {
	Convey(desc, t, func() {
		tempDir, _ := ioutil.TempDir("", "store")

		store := NewFileStore(tempDir)

		f(store)

		Reset(func() {
			os.RemoveAll(tempDir)
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
