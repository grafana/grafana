package storage

import (
	"archive/zip"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/log"
)

func TestAdd(t *testing.T) {
	testDir := "./testdata/tmpInstallPluginDir"
	err := os.MkdirAll(testDir, os.ModePerm)
	require.NoError(t, err)

	t.Cleanup(func() {
		err = os.RemoveAll(testDir)
		require.NoError(t, err)
	})

	pluginID := "test-app"

	fs := FileSystem(log.NewTestPrettyLogger(), testDir)
	archive, err := fs.Extract(context.Background(), pluginID, zipFile(t, "./testdata/plugin-with-symlinks.zip"))
	require.NotNil(t, archive)
	require.NoError(t, err)

	// verify extracted contents
	files, err := os.ReadDir(filepath.Join(testDir, pluginID))
	require.NoError(t, err)
	file2, err := files[2].Info()
	require.NoError(t, err)
	file4, err := files[4].Info()
	require.NoError(t, err)

	require.Len(t, files, 6)
	require.Equal(t, files[0].Name(), "MANIFEST.txt")
	require.Equal(t, files[1].Name(), "dashboards")
	require.Equal(t, files[2].Name(), "extra")
	require.Equal(t, os.ModeSymlink, file2.Mode()&os.ModeSymlink)
	require.Equal(t, files[3].Name(), "plugin.json")
	require.Equal(t, files[4].Name(), "symlink_to_txt")
	require.Equal(t, os.ModeSymlink, file4.Mode()&os.ModeSymlink)
	require.Equal(t, files[5].Name(), "text.txt")
}

func TestExtractFiles(t *testing.T) {
	pluginsDir := setupFakePluginsDir(t)

	i := &FS{log: log.NewTestPrettyLogger(), pluginsDir: pluginsDir}

	t.Run("Should preserve file permissions for plugin backend binaries for linux and darwin", func(t *testing.T) {
		skipWindows(t)

		pluginID := "grafana-simple-json-datasource"
		path, err := i.extractFiles(context.Background(), zipFile(t, "testdata/grafana-simple-json-datasource-ec18fa4da8096a952608a7e4c7782b4260b41bcf.zip"), pluginID)
		require.Equal(t, filepath.Join(pluginsDir, pluginID), path)
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
		require.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())

		// File in zip has permission 755
		fileInfo, err = os.Stat(pluginsDir + "/grafana-simple-json-datasource/non-plugin-binary")
		require.NoError(t, err)
		require.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())
	})

	t.Run("Should extract file with relative symlink", func(t *testing.T) {
		skipWindows(t)

		pluginID := "plugin-with-symlink"
		path, err := i.extractFiles(context.Background(), zipFile(t, "testdata/plugin-with-symlink.zip"), pluginID)
		require.Equal(t, filepath.Join(pluginsDir, pluginID), path)
		require.NoError(t, err)

		_, err = os.Stat(pluginsDir + "/plugin-with-symlink/symlink_to_txt")
		require.NoError(t, err)

		target, err := filepath.EvalSymlinks(pluginsDir + "/plugin-with-symlink/symlink_to_txt")
		require.NoError(t, err)
		require.Equal(t, pluginsDir+"/plugin-with-symlink/text.txt", target)
	})

	t.Run("Should extract directory with relative symlink", func(t *testing.T) {
		skipWindows(t)

		pluginID := "plugin-with-symlink-dir"
		path, err := i.extractFiles(context.Background(), zipFile(t, "testdata/plugin-with-symlink-dir.zip"), pluginID)
		require.Equal(t, filepath.Join(pluginsDir, pluginID), path)
		require.NoError(t, err)

		_, err = os.Stat(pluginsDir + "/plugin-with-symlink-dir/symlink_to_dir")
		require.NoError(t, err)

		target, err := filepath.EvalSymlinks(pluginsDir + "/plugin-with-symlink-dir/symlink_to_dir")
		require.NoError(t, err)
		require.Equal(t, pluginsDir+"/plugin-with-symlink-dir/dir", target)
	})

	t.Run("Should not extract file with absolute symlink", func(t *testing.T) {
		skipWindows(t)

		pluginID := "plugin-with-absolute-symlink"
		path, err := i.extractFiles(context.Background(), zipFile(t, "testdata/plugin-with-absolute-symlink.zip"), pluginID)
		require.Equal(t, filepath.Join(pluginsDir, pluginID), path)
		require.NoError(t, err)

		_, err = os.Stat(pluginsDir + "/plugin-with-absolute-symlink/test.txt")
		require.True(t, os.IsNotExist(err))
	})

	t.Run("Should not extract directory with absolute symlink", func(t *testing.T) {
		skipWindows(t)

		pluginID := "plugin-with-absolute-symlink-dir"
		path, err := i.extractFiles(context.Background(), zipFile(t, "testdata/plugin-with-absolute-symlink-dir.zip"), pluginID)
		require.Equal(t, filepath.Join(pluginsDir, pluginID), path)
		require.NoError(t, err)

		_, err = os.Stat(pluginsDir + "/plugin-with-absolute-symlink-dir/target")
		require.True(t, os.IsNotExist(err))
	})

	t.Run("Should detect if archive members point outside of the destination directory", func(t *testing.T) {
		path, err := i.extractFiles(context.Background(), zipFile(t, "testdata/plugin-with-parent-member.zip"), "plugin-with-parent-member")
		require.Empty(t, path)
		require.EqualError(t, err, fmt.Sprintf(
			`archive member "../member.txt" tries to write outside of plugin directory: %q, this can be a security risk`,
			pluginsDir,
		))
	})

	t.Run("Should detect if archive members are absolute", func(t *testing.T) {
		path, err := i.extractFiles(context.Background(), zipFile(t, "testdata/plugin-with-absolute-member.zip"), "plugin-with-absolute-member")
		require.Empty(t, path)
		require.EqualError(t, err, fmt.Sprintf(
			`archive member "/member.txt" tries to write outside of plugin directory: %q, this can be a security risk`,
			pluginsDir,
		))
	})
}

func zipFile(t *testing.T, zipPath string) *zip.ReadCloser {
	rc, err := zip.OpenReader(zipPath)
	require.NoError(t, err)

	return rc
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
