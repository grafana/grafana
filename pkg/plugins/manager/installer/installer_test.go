package installer

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInstall(t *testing.T) {
	testDir := "./testdata/tmpInstallPluginDir"
	err := os.Mkdir(testDir, os.ModePerm)
	require.NoError(t, err)

	t.Cleanup(func() {
		err = os.RemoveAll(testDir)
		require.NoError(t, err)
	})

	pluginID := "test-app"

	i := &Installer{log: &fakeLogger{}}
	err = i.Install(context.Background(), pluginID, "", testDir, "./testdata/plugin-with-symlinks.zip", "")
	require.NoError(t, err)

	// verify extracted contents
	files, err := ioutil.ReadDir(filepath.Join(testDir, pluginID))
	require.NoError(t, err)
	require.Len(t, files, 6)
	require.Equal(t, files[0].Name(), "MANIFEST.txt")
	require.Equal(t, files[1].Name(), "dashboards")
	require.Equal(t, files[2].Name(), "extra")
	require.Equal(t, os.ModeSymlink, files[2].Mode()&os.ModeSymlink)
	require.Equal(t, files[3].Name(), "plugin.json")
	require.Equal(t, files[4].Name(), "symlink_to_txt")
	require.Equal(t, os.ModeSymlink, files[4].Mode()&os.ModeSymlink)
	require.Equal(t, files[5].Name(), "text.txt")
}

func TestUninstall(t *testing.T) {
	i := &Installer{log: &fakeLogger{}}

	pluginDir := t.TempDir()
	pluginJSON := filepath.Join(pluginDir, "plugin.json")
	_, err := os.Create(pluginJSON)
	require.NoError(t, err)

	err = i.Uninstall(context.Background(), pluginDir)
	require.NoError(t, err)

	_, err = os.Stat(pluginDir)
	require.True(t, os.IsNotExist(err))

	t.Run("Uninstall will search in nested dir folder for plugin.json", func(t *testing.T) {
		pluginDistDir := filepath.Join(t.TempDir(), "dist")
		err = os.Mkdir(pluginDistDir, os.ModePerm)
		require.NoError(t, err)
		pluginJSON = filepath.Join(pluginDistDir, "plugin.json")
		_, err = os.Create(pluginJSON)
		require.NoError(t, err)

		pluginDir = filepath.Dir(pluginDistDir)

		err = i.Uninstall(context.Background(), pluginDir)
		require.NoError(t, err)

		_, err = os.Stat(pluginDir)
		require.True(t, os.IsNotExist(err))
	})

	t.Run("Uninstall will not delete folder if cannot recognize plugin structure", func(t *testing.T) {
		pluginDir = t.TempDir()
		err = i.Uninstall(context.Background(), pluginDir)
		require.EqualError(t, err, fmt.Sprintf("tried to remove %s, but it doesn't seem to be a plugin", pluginDir))

		_, err = os.Stat(pluginDir)
		require.False(t, os.IsNotExist(err))
	})
}

func TestExtractFiles(t *testing.T) {
	i := &Installer{log: &fakeLogger{}}
	pluginsDir := setupFakePluginsDir(t)

	t.Run("Should preserve file permissions for plugin backend binaries for linux and darwin", func(t *testing.T) {
		skipWindows(t)

		archive := filepath.Join("testdata", "grafana-simple-json-datasource-ec18fa4da8096a952608a7e4c7782b4260b41bcf.zip")
		err := i.extractFiles(archive, "grafana-simple-json-datasource", pluginsDir)
		require.NoError(t, err)

		// File in zip has permissions 755
		fileInfo, err := os.Stat(filepath.Join(pluginsDir, "grafana-simple-json-datasource", "simple-plugin_darwin_amd64"))
		require.NoError(t, err)
		require.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())

		// File in zip has permission 755
		fileInfo, err = os.Stat(pluginsDir + "/grafana-simple-json-datasource/simple-plugin_linux_amd64")
		require.NoError(t, err)
		require.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())

		// File in zip has permission 644
		fileInfo, err = os.Stat(pluginsDir + "/grafana-simple-json-datasource/simple-plugin_windows_amd64.exe")
		require.NoError(t, err)
		require.Equal(t, "-rw-r--r--", fileInfo.Mode().String())

		// File in zip has permission 755
		fileInfo, err = os.Stat(pluginsDir + "/grafana-simple-json-datasource/non-plugin-binary")
		require.NoError(t, err)
		require.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())
	})

	t.Run("Should extract file with relative symlink", func(t *testing.T) {
		skipWindows(t)

		err := i.extractFiles("testdata/plugin-with-symlink.zip", "plugin-with-symlink", pluginsDir)
		require.NoError(t, err)

		_, err = os.Stat(pluginsDir + "/plugin-with-symlink/symlink_to_txt")
		require.NoError(t, err)

		target, err := filepath.EvalSymlinks(pluginsDir + "/plugin-with-symlink/symlink_to_txt")
		require.NoError(t, err)
		require.Equal(t, pluginsDir+"/plugin-with-symlink/text.txt", target)
	})

	t.Run("Should extract directory with relative symlink", func(t *testing.T) {
		skipWindows(t)

		err := i.extractFiles("testdata/plugin-with-symlink-dir.zip", "plugin-with-symlink-dir", pluginsDir)
		require.NoError(t, err)

		_, err = os.Stat(pluginsDir + "/plugin-with-symlink-dir/symlink_to_dir")
		require.NoError(t, err)

		target, err := filepath.EvalSymlinks(pluginsDir + "/plugin-with-symlink-dir/symlink_to_dir")
		require.NoError(t, err)
		require.Equal(t, pluginsDir+"/plugin-with-symlink-dir/dir", target)
	})

	t.Run("Should not extract file with absolute symlink", func(t *testing.T) {
		skipWindows(t)

		err := i.extractFiles("testdata/plugin-with-absolute-symlink.zip", "plugin-with-absolute-symlink", pluginsDir)
		require.NoError(t, err)

		_, err = os.Stat(pluginsDir + "/plugin-with-absolute-symlink/test.txt")
		require.True(t, os.IsNotExist(err))
	})

	t.Run("Should not extract directory with absolute symlink", func(t *testing.T) {
		skipWindows(t)

		err := i.extractFiles("testdata/plugin-with-absolute-symlink-dir.zip", "plugin-with-absolute-symlink-dir", pluginsDir)
		require.NoError(t, err)

		_, err = os.Stat(pluginsDir + "/plugin-with-absolute-symlink-dir/target")
		require.True(t, os.IsNotExist(err))
	})

	t.Run("Should detect if archive members point outside of the destination directory", func(t *testing.T) {
		err := i.extractFiles("testdata/plugin-with-parent-member.zip", "plugin-with-parent-member", pluginsDir)
		require.EqualError(t, err, fmt.Sprintf(
			`archive member "../member.txt" tries to write outside of plugin directory: %q, this can be a security risk`,
			pluginsDir,
		))
	})

	t.Run("Should detect if archive members are absolute", func(t *testing.T) {
		err := i.extractFiles("testdata/plugin-with-absolute-member.zip", "plugin-with-absolute-member", pluginsDir)
		require.EqualError(t, err, fmt.Sprintf(
			`archive member "/member.txt" tries to write outside of plugin directory: %q, this can be a security risk`,
			pluginsDir,
		))
	})
}

func TestSelectVersion(t *testing.T) {
	i := &Installer{log: &fakeLogger{}}

	t.Run("Should return error when requested version does not exist", func(t *testing.T) {
		_, err := i.selectVersion(createPlugin(versionArg{version: "version"}), "1.1.1")
		require.Error(t, err)
	})

	t.Run("Should return error when no version supports current arch", func(t *testing.T) {
		_, err := i.selectVersion(createPlugin(versionArg{version: "version", arch: []string{"non-existent"}}), "")
		require.Error(t, err)
	})

	t.Run("Should return error when requested version does not support current arch", func(t *testing.T) {
		_, err := i.selectVersion(createPlugin(
			versionArg{version: "2.0.0"},
			versionArg{version: "1.1.1", arch: []string{"non-existent"}},
		), "1.1.1")
		require.Error(t, err)
	})

	t.Run("Should return latest available for arch when no version specified", func(t *testing.T) {
		ver, err := i.selectVersion(createPlugin(
			versionArg{version: "2.0.0", arch: []string{"non-existent"}},
			versionArg{version: "1.0.0"},
		), "")
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})

	t.Run("Should return latest version when no version specified", func(t *testing.T) {
		ver, err := i.selectVersion(createPlugin(versionArg{version: "2.0.0"}, versionArg{version: "1.0.0"}), "")
		require.NoError(t, err)
		require.Equal(t, "2.0.0", ver.Version)
	})

	t.Run("Should return requested version", func(t *testing.T) {
		ver, err := i.selectVersion(createPlugin(versionArg{version: "2.0.0"}, versionArg{version: "1.0.0"}), "1.0.0")
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})
}

func TestRemoveGitBuildFromName(t *testing.T) {
	// The root directory should get renamed to the plugin name
	paths := map[string]string{
		"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/":                     "datasource-kairosdb/",
		"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/README.md":            "datasource-kairosdb/README.md",
		"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/partials/":            "datasource-kairosdb/partials/",
		"datasource-plugin-kairosdb-cc4a3965ef5d3eb1ae0ee4f93e9e78ec7db69e64/partials/config.html": "datasource-kairosdb/partials/config.html",
	}
	for p, exp := range paths {
		name := removeGitBuildFromName(p, "datasource-kairosdb")
		require.Equal(t, exp, name)
	}
}

func TestIsSymlinkRelativeTo(t *testing.T) {
	tcs := []struct {
		desc            string
		basePath        string
		symlinkDestPath string
		symlinkOrigPath string
		expected        bool
	}{
		{
			desc:            "Symbolic link pointing to relative file within basePath should return true",
			basePath:        "/dir",
			symlinkDestPath: "test.txt",
			symlinkOrigPath: "/dir/sub-dir/test1.txt",
			expected:        true,
		},
		{
			desc:            "Symbolic link pointing to relative file within basePath should return true",
			basePath:        "/dir",
			symlinkDestPath: "test.txt",
			symlinkOrigPath: "/dir/test1.txt",
			expected:        true,
		},
		{
			desc:            "Symbolic link pointing to relative file within basePath should return true",
			basePath:        "/dir",
			symlinkDestPath: "../etc/test.txt",
			symlinkOrigPath: "/dir/sub-dir/test1.txt",
			expected:        true,
		},
		{
			desc:            "Symbolic link pointing to absolute directory outside basePath should return false",
			basePath:        "/dir",
			symlinkDestPath: "/etc/test.txt",
			symlinkOrigPath: "/dir/sub-dir/test1.txt",
			expected:        false,
		},
		{
			desc:            "Symbolic link pointing to relative file outside basePath should return false",
			basePath:        "/dir",
			symlinkDestPath: "../../etc/test.txt",
			symlinkOrigPath: "/dir/sub-dir/test1.txt",
			expected:        false,
		},
		{
			desc:            "Symbolic link pointing to relative file outside basePath should return false",
			basePath:        "/dir",
			symlinkDestPath: "../../",
			symlinkOrigPath: "/dir/sub-sir/symlink.txt",
			expected:        false,
		},
		{
			desc:            "Symbolic link pointing to relative file outside basePath should return false",
			basePath:        "/dir",
			symlinkDestPath: "../..",
			symlinkOrigPath: "/dir/sub-sir/symlink.txt",
			expected:        false,
		},
		{
			desc:            "Symbolic link pointing to relative file outside basePath should return false",
			basePath:        "/dir",
			symlinkDestPath: "../../",
			symlinkOrigPath: "/dir/sub-sir/",
			expected:        false,
		},
		{
			desc:            "Symbolic link pointing to relative file outside basePath should return false",
			basePath:        "/dir",
			symlinkDestPath: "../..",
			symlinkOrigPath: "/dir/sub-sir/",
			expected:        false,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			actual := isSymlinkRelativeTo(tc.basePath, tc.symlinkDestPath, tc.symlinkOrigPath)
			require.Equal(t, tc.expected, actual)
		})
	}
}

func setupFakePluginsDir(t *testing.T) string {
	dir := "testdata/fake-plugins-dir"
	err := os.RemoveAll(dir)
	require.NoError(t, err)

	err = os.MkdirAll(dir, 0750)
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(dir)
		require.NoError(t, err)
	})

	dir, err = filepath.Abs(dir)
	require.NoError(t, err)

	return dir
}

func skipWindows(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping test on Windows")
	}
}

type versionArg struct {
	version string
	arch    []string
}

func createPlugin(versions ...versionArg) *Plugin {
	p := &Plugin{
		Versions: []Version{},
	}

	for _, version := range versions {
		ver := Version{
			Version: version.version,
			Commit:  fmt.Sprintf("commit_%s", version.version),
			URL:     fmt.Sprintf("url_%s", version.version),
		}
		if version.arch != nil {
			ver.Arch = map[string]ArchMeta{}
			for _, arch := range version.arch {
				ver.Arch[arch] = ArchMeta{
					SHA256: fmt.Sprintf("sha256_%s", arch),
				}
			}
		}
		p.Versions = append(p.Versions, ver)
	}

	return p
}

type fakeLogger struct{}

func (f *fakeLogger) Successf(_ string, _ ...interface{}) {}
func (f *fakeLogger) Failuref(_ string, _ ...interface{}) {}
func (f *fakeLogger) Info(_ ...interface{})               {}
func (f *fakeLogger) Infof(_ string, _ ...interface{})    {}
func (f *fakeLogger) Debug(_ ...interface{})              {}
func (f *fakeLogger) Debugf(_ string, _ ...interface{})   {}
func (f *fakeLogger) Warn(_ ...interface{})               {}
func (f *fakeLogger) Warnf(_ string, _ ...interface{})    {}
func (f *fakeLogger) Error(_ ...interface{})              {}
func (f *fakeLogger) Errorf(_ string, _ ...interface{})   {}
