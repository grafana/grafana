package commands

import (
	"io/ioutil"
	"os"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestFoldernameReplacement(t *testing.T) {
	Convey("path containing git commit path", t, func() {
		pluginName := "datasource-plugin-kairosdb"

		paths := map[string]string{
			"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/":                     "datasource-plugin-kairosdb/",
			"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/README.md":            "datasource-plugin-kairosdb/README.md",
			"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/partials/":            "datasource-plugin-kairosdb/partials/",
			"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/partials/config.html": "datasource-plugin-kairosdb/partials/config.html",
		}

		Convey("should be replaced with plugin name", func() {
			for k, v := range paths {
				So(RemoveGitBuildFromName(pluginName, k), ShouldEqual, v)
			}
		})
	})

	Convey("path containing git commit path", t, func() {
		pluginName := "app-example"
		paths := map[string]string{
			"app-plugin-example-3c28f65ac6fb7f1e234b0364b97081d836495439/": "app-example/",
		}

		Convey("should be replaced with plugin name", func() {
			for k, v := range paths {
				So(RemoveGitBuildFromName(pluginName, k), ShouldEqual, v)
			}
		})
	})
}

func TestExtractFiles(t *testing.T) {
	Convey("Should preserve file permissions for plugin backend binaries for linux and darwin", t, func() {
		err := os.RemoveAll("testdata/fake-plugins-dir")
		So(err, ShouldBeNil)

		err = os.MkdirAll("testdata/fake-plugins-dir", 0774)
		So(err, ShouldBeNil)

		body, err := ioutil.ReadFile("testdata/grafana-simple-json-datasource-ec18fa4da8096a952608a7e4c7782b4260b41bcf.zip")
		So(err, ShouldBeNil)

		err = extractFiles(body, "grafana-simple-json-datasource", "testdata/fake-plugins-dir")
		So(err, ShouldBeNil)

		//File in zip has permissions 777
		fileInfo, err := os.Stat("testdata/fake-plugins-dir/grafana-simple-json-datasource/simple-plugin_darwin_amd64")
		So(err, ShouldBeNil)
		So(fileInfo.Mode().String(), ShouldEqual, "-rwxr-xr-x")

		//File in zip has permission 664
		fileInfo, err = os.Stat("testdata/fake-plugins-dir/grafana-simple-json-datasource/simple-plugin_linux_amd64")
		So(err, ShouldBeNil)
		So(fileInfo.Mode().String(), ShouldEqual, "-rwxr-xr-x")

		//File in zip has permission 644
		fileInfo, err = os.Stat("testdata/fake-plugins-dir/grafana-simple-json-datasource/simple-plugin_windows_amd64.exe")
		So(err, ShouldBeNil)
		So(fileInfo.Mode().String(), ShouldEqual, "-rw-r--r--")

		//File in zip has permission 755
		fileInfo, err = os.Stat("testdata/fake-plugins-dir/grafana-simple-json-datasource/non-plugin-binary")
		So(err, ShouldBeNil)
		So(fileInfo.Mode().String(), ShouldEqual, "-rwxr-xr-x")

		err = os.RemoveAll("testdata/fake-plugins-dir")
		So(err, ShouldBeNil)
	})
}
