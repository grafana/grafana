package commands

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/commandstest"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoveGitBuildFromName(t *testing.T) {
	pluginName := "datasource-kairosdb"

	// The root directory should get renamed to the plugin name
	paths := map[string]string{
		"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/":                     "datasource-kairosdb/",
		"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/README.md":            "datasource-kairosdb/README.md",
		"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/partials/":            "datasource-kairosdb/partials/",
		"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/partials/config.html": "datasource-kairosdb/partials/config.html",
	}
	for pth, exp := range paths {
		name := removeGitBuildFromName(pluginName, pth)
		assert.Equal(t, exp, name)
	}
}

func TestExtractFiles(t *testing.T) {
	t.Run("Should preserve file permissions for plugin backend binaries for linux and darwin", func(t *testing.T) {
		skipWindows(t)
		pluginDir, del := setupFakePluginsDir(t)
		defer del()

		archive := filepath.Join("testdata", "grafana-simple-json-datasource-ec18fa4da8096a952608a7e4c7782b4260b41bcf.zip")
		err := extractFiles(archive, "grafana-simple-json-datasource", pluginDir, false)
		require.NoError(t, err)

		//File in zip has permissions 755
		fileInfo, err := os.Stat(filepath.Join(pluginDir, "grafana-simple-json-datasource",
			"simple-plugin_darwin_amd64"))
		require.NoError(t, err)
		assert.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())

		//File in zip has permission 755
		fileInfo, err = os.Stat(pluginDir + "/grafana-simple-json-datasource/simple-plugin_linux_amd64")
		require.NoError(t, err)
		assert.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())

		//File in zip has permission 644
		fileInfo, err = os.Stat(pluginDir + "/grafana-simple-json-datasource/simple-plugin_windows_amd64.exe")
		require.NoError(t, err)
		assert.Equal(t, "-rw-r--r--", fileInfo.Mode().String())

		//File in zip has permission 755
		fileInfo, err = os.Stat(pluginDir + "/grafana-simple-json-datasource/non-plugin-binary")
		require.NoError(t, err)
		assert.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())
	})

	t.Run("Should ignore symlinks if not allowed", func(t *testing.T) {
		pluginDir, del := setupFakePluginsDir(t)
		defer del()

		err := extractFiles("testdata/plugin-with-symlink.zip", "plugin-with-symlink", pluginDir, false)
		require.NoError(t, err)

		_, err = os.Stat(pluginDir + "/plugin-with-symlink/text.txt")
		require.NoError(t, err)
		_, err = os.Stat(pluginDir + "/plugin-with-symlink/symlink_to_txt")
		assert.NotNil(t, err)
	})

	t.Run("Should extract symlinks if allowed", func(t *testing.T) {
		skipWindows(t)
		pluginDir, del := setupFakePluginsDir(t)
		defer del()

		err := extractFiles("testdata/plugin-with-symlink.zip", "plugin-with-symlink", pluginDir, true)
		require.NoError(t, err)

		_, err = os.Stat(pluginDir + "/plugin-with-symlink/symlink_to_txt")
		require.NoError(t, err)
		fmt.Println(err)
	})
}

func TestInstallPluginCommand(t *testing.T) {
	pluginsDir, cleanUp := setupFakePluginsDir(t)
	defer cleanUp()
	c, err := commandstest.NewCliContext(map[string]string{"pluginsDir": pluginsDir})
	require.NoError(t, err)

	client := &commandstest.FakeGrafanaComClient{
		GetPluginFunc: func(pluginId, repoUrl string) (models.Plugin, error) {
			require.Equal(t, "test-plugin-panel", pluginId)
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
		},
		DownloadFileFunc: func(pluginName string, tmpFile *os.File, url string, checksum string) (err error) {
			require.Equal(t, "test-plugin-panel", pluginName)
			require.Equal(t, "/test-plugin-panel/versions/1.0.0/download", url)
			require.Equal(t, "test", checksum)
			f, err := os.Open("testdata/grafana-simple-json-datasource-ec18fa4da8096a952608a7e4c7782b4260b41bcf.zip")
			require.NoError(t, err)
			_, err = io.Copy(tmpFile, f)
			require.NoError(t, err)
			return nil
		},
	}

	err = InstallPlugin("test-plugin-panel", "", c, client)
	assert.NoError(t, err)
}

func TestIsPathSafe(t *testing.T) {
	dest := fmt.Sprintf("%stest%spath", string(os.PathSeparator), string(os.PathSeparator))

	t.Run("Should be true on nested destinations", func(t *testing.T) {
		assert.True(t, isPathSafe("dest", dest))
		assert.True(t, isPathSafe("dest/one", dest))
		assert.True(t, isPathSafe("../path/dest/one", dest))
	})

	t.Run("Should be false on destinations outside of path", func(t *testing.T) {
		assert.False(t, isPathSafe("../dest", dest))
		assert.False(t, isPathSafe("../../", dest))
		assert.False(t, isPathSafe("../../test", dest))
	})
}

func TestSelectVersion(t *testing.T) {
	t.Run("Should return error when requested version does not exist", func(t *testing.T) {
		_, err := SelectVersion(
			makePluginWithVersions(versionArg{Version: "version"}),
			"1.1.1",
		)
		assert.NotNil(t, err)
	})

	t.Run("Should return error when no version supports current arch", func(t *testing.T) {
		_, err := SelectVersion(
			makePluginWithVersions(versionArg{Version: "version", Arch: []string{"non-existent"}}),
			"",
		)
		assert.NotNil(t, err)
	})

	t.Run("Should return error when requested version does not support current arch", func(t *testing.T) {
		_, err := SelectVersion(
			makePluginWithVersions(
				versionArg{Version: "2.0.0"},
				versionArg{Version: "1.1.1", Arch: []string{"non-existent"}},
			),
			"1.1.1",
		)
		assert.NotNil(t, err)
	})

	t.Run("Should return latest available for arch when no version specified", func(t *testing.T) {
		ver, err := SelectVersion(
			makePluginWithVersions(
				versionArg{Version: "2.0.0", Arch: []string{"non-existent"}},
				versionArg{Version: "1.0.0"},
			),
			"",
		)
		require.NoError(t, err)
		assert.Equal(t, "1.0.0", ver.Version)
	})

	t.Run("Should return latest version when no version specified", func(t *testing.T) {
		ver, err := SelectVersion(
			makePluginWithVersions(versionArg{Version: "2.0.0"}, versionArg{Version: "1.0.0"}),
			"",
		)
		require.NoError(t, err)
		assert.Equal(t, "2.0.0", ver.Version)
	})

	t.Run("Should return requested version", func(t *testing.T) {
		ver, err := SelectVersion(
			makePluginWithVersions(
				versionArg{Version: "2.0.0"},
				versionArg{Version: "1.0.0"},
			),
			"1.0.0",
		)
		require.NoError(t, err)
		assert.Equal(t, "1.0.0", ver.Version)
	})
}

func setupFakePluginsDir(t *testing.T) (string, func()) {
	dirname := "testdata/fake-plugins-dir"
	err := os.RemoveAll(dirname)
	require.Nil(t, err)

	err = os.MkdirAll(dirname, 0774)
	require.Nil(t, err)

	return dirname, func() {
		err := os.RemoveAll(dirname)
		require.NoError(t, err)
	}
}

func skipWindows(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping test on Windows")
	}
}

type versionArg struct {
	Version string
	Arch    []string
}

func makePluginWithVersions(versions ...versionArg) *models.Plugin {
	plugin := &models.Plugin{
		Id:       "",
		Category: "",
		Versions: []models.Version{},
	}

	for _, version := range versions {
		ver := models.Version{
			Version: version.Version,
			Commit:  fmt.Sprintf("commit_%s", version.Version),
			Url:     fmt.Sprintf("url_%s", version.Version),
		}
		if version.Arch != nil {
			ver.Arch = map[string]models.ArchMeta{}
			for _, arch := range version.Arch {
				ver.Arch[arch] = models.ArchMeta{
					Md5: fmt.Sprintf("md5_%s", arch),
				}
			}
		}
		plugin.Versions = append(plugin.Versions, ver)
	}

	return plugin
}
