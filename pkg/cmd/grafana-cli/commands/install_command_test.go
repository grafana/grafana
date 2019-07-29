package commands

import (
	"fmt"
	"io/ioutil"
	"os"
	"runtime"
	"testing"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/commandstest"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	. "github.com/smartystreets/goconvey/convey"
	"github.com/stretchr/testify/assert"
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
	t.Run("Should preserve file permissions for plugin backend binaries for linux and darwin", func(t *testing.T) {
		pluginDir, del := setupFakePluginsDir(t)
		defer del()

		body, err := ioutil.ReadFile("testdata/grafana-simple-json-datasource-ec18fa4da8096a952608a7e4c7782b4260b41bcf.zip")
		assert.Nil(t, err)

		err = extractFiles(body, "grafana-simple-json-datasource", pluginDir, false)
		assert.Nil(t, err)

		//File in zip has permissions 755
		fileInfo, err := os.Stat(pluginDir + "/grafana-simple-json-datasource/simple-plugin_darwin_amd64")
		assert.Nil(t, err)
		assert.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())

		//File in zip has permission 755
		fileInfo, err = os.Stat(pluginDir + "/grafana-simple-json-datasource/simple-plugin_linux_amd64")
		assert.Nil(t, err)
		assert.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())

		//File in zip has permission 644
		fileInfo, err = os.Stat(pluginDir + "/grafana-simple-json-datasource/simple-plugin_windows_amd64.exe")
		assert.Nil(t, err)
		assert.Equal(t, "-rw-r--r--", fileInfo.Mode().String())

		//File in zip has permission 755
		fileInfo, err = os.Stat(pluginDir + "/grafana-simple-json-datasource/non-plugin-binary")
		assert.Nil(t, err)
		assert.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())
	})

	t.Run("Should ignore symlinks if not allowed", func(t *testing.T) {
		pluginDir, del := setupFakePluginsDir(t)
		defer del()

		body, err := ioutil.ReadFile("testdata/plugin-with-symlink.zip")
		assert.Nil(t, err)

		err = extractFiles(body, "plugin-with-symlink", pluginDir, false)
		assert.Nil(t, err)

		_, err = os.Stat(pluginDir + "/plugin-with-symlink/text.txt")
		assert.Nil(t, err)
		_, err = os.Stat(pluginDir + "/plugin-with-symlink/symlink_to_txt")
		assert.NotNil(t, err)
	})

	t.Run("Should extract symlinks if allowed", func(t *testing.T) {
		pluginDir, del := setupFakePluginsDir(t)
		defer del()

		body, err := ioutil.ReadFile("testdata/plugin-with-symlink.zip")
		assert.Nil(t, err)

		err = extractFiles(body, "plugin-with-symlink", pluginDir, true)
		assert.Nil(t, err)

		_, err = os.Stat(pluginDir + "/plugin-with-symlink/symlink_to_txt")
		assert.Nil(t, err)
		fmt.Println(err)
	})
}

func TestInstallPluginCommand(t *testing.T) {
	pluginDir, del := setupFakePluginsDir(t)
	defer del()
	cmd := setupPluginInstallCmd(t, pluginDir)
	err := InstallPlugin("test-plugin-panel", "", cmd)
	assert.Nil(t, err)
}

func TestIsPathSafe(t *testing.T) {
	t.Run("Should be true on nested destinations", func(t *testing.T) {
		assert.True(t, isPathSafe("dest", "/test/path"))
		assert.True(t, isPathSafe("dest/one", "/test/path"))
		assert.True(t, isPathSafe("../path/dest/one", "/test/path"))
	})

	t.Run("Should be false on destinations outside of path", func(t *testing.T) {
		assert.False(t, isPathSafe("../dest", "/test/path"))
		assert.False(t, isPathSafe("../../", "/test/path"))
		assert.False(t, isPathSafe("../../test", "/test/path"))
	})

}

func setupPluginInstallCmd(t *testing.T, pluginDir string) utils.CommandLine {
	cmd := &commandstest.FakeCommandLine{
		GlobalFlags: &commandstest.FakeFlagger{Data: map[string]interface{}{
			"pluginsDir": pluginDir,
		}},
	}

	client := &commandstest.FakeGrafanaComClient{}

	client.GetPluginFunc = func(pluginId, repoUrl string) (models.Plugin, error) {
		assert.Equal(t, "test-plugin-panel", pluginId)
		plugin := models.Plugin{
			Id:       "test-plugin-panel",
			Category: "",
			Versions: []models.Version{
				{
					Commit:  "commit",
					Url:     "url",
					Version: "1.0.0",
					Arch: map[string]models.ArchMeta{
						fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH): {
							Md5: "test",
						},
					},
				},
			},
		}
		return plugin, nil
	}

	client.DownloadFileFunc = func(pluginName, filePath, url string, checksum string) (content []byte, err error) {
		assert.Equal(t, "test-plugin-panel", pluginName)
		assert.Equal(t, "/test-plugin-panel/versions/1.0.0/download", url)
		assert.Equal(t, "test", checksum)
		body, err := ioutil.ReadFile("testdata/grafana-simple-json-datasource-ec18fa4da8096a952608a7e4c7782b4260b41bcf.zip")
		assert.Nil(t, err)
		return body, nil
	}

	cmd.Client = client
	return cmd
}

func setupFakePluginsDir(t *testing.T) (string, func()) {
	dirname := "testdata/fake-plugins-dir"
	err := os.RemoveAll(dirname)
	assert.Nil(t, err)

	err = os.MkdirAll(dirname, 0774)
	assert.Nil(t, err)

	return dirname, func() {
		err = os.RemoveAll(dirname)
		assert.Nil(t, err)
	}
}
