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
	testDir := filepath.Join("testdata", "tmpInstallPluginDir")
	err := os.MkdirAll(testDir, 0o750)
	require.NoError(t, err)

	t.Cleanup(func() {
		err = os.RemoveAll(testDir)
		require.NoError(t, err)
	})

	pluginID := "test-app"

	fs := FileSystem(log.NewTestPrettyLogger(), testDir)
	archive, err := fs.Extract(context.Background(), pluginID, SimpleDirNameGeneratorFunc, zipFile(t, filepath.Join("testdata", "plugin-with-symlinks.zip")))
	require.NotNil(t, archive)
	require.NoError(t, err)

	// verify extracted contents
	files, err := os.ReadDir(archive.Path)
	require.NoError(t, err)
	require.Len(t, files, 6)
	require.Equal(t, files[0].Name(), "MANIFEST.txt")
	require.Equal(t, files[1].Name(), "dashboards")
	require.Equal(t, files[2].Name(), "extra")
	file2, err := files[2].Info()
	require.NoError(t, err)
	require.Equal(t, os.ModeSymlink, file2.Mode()&os.ModeSymlink)
	require.Equal(t, files[3].Name(), "plugin.json")
	require.Equal(t, files[4].Name(), "symlink_to_txt")
	file4, err := files[4].Info()
	require.NoError(t, err)
	require.Equal(t, os.ModeSymlink, file4.Mode()&os.ModeSymlink)
	require.Equal(t, files[5].Name(), "text.txt")
}

func TestExtractFiles(t *testing.T) {
	testDir := filepath.Join("testdata", "tmpInstallPluginDir")
	err := os.MkdirAll(testDir, 0o750)
	require.NoError(t, err)

	t.Cleanup(func() {
		err = os.RemoveAll(testDir)
		require.NoError(t, err)
	})

	fs := FileSystem(log.NewTestPrettyLogger(), testDir)

	t.Run("Should preserve file permissions for plugin backend binaries for linux and darwin", func(t *testing.T) {
		skipWindows(t)

		pluginID := "grafana-simple-json-datasource"
		path, err := fs.extractFiles(context.Background(), zipFile(t, filepath.Join("testdata", "grafana-simple-json-datasource-ec18fa4da8096a952608a7e4c7782b4260b41bcf.zip")), pluginID, SimpleDirNameGeneratorFunc)
		require.Equal(t, filepath.Join(testDir, pluginID), path)
		require.NoError(t, err)

		// File in zip has permissions 755
		fileInfo, err := os.Stat(filepath.Join(path, "simple-plugin_darwin_amd64"))
		require.NoError(t, err)
		require.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())

		// File in zip has permission 755
		fileInfo, err = os.Stat(filepath.Join(path, "simple-plugin_linux_amd64"))
		require.NoError(t, err)
		require.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())

		// File in zip has permission 644
		fileInfo, err = os.Stat(filepath.Join(path, "simple-plugin_windows_amd64.exe"))
		require.NoError(t, err)
		require.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())

		// File in zip has permission 755
		fileInfo, err = os.Stat(filepath.Join(path, "non-plugin-binary"))
		require.NoError(t, err)
		require.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())
	})

	t.Run("Should extract file with relative symlink", func(t *testing.T) {
		skipWindows(t)

		pluginID := "plugin-with-symlink"
		path, err := fs.extractFiles(context.Background(), zipFile(t, filepath.Join("testdata", "plugin-with-symlink.zip")), pluginID, SimpleDirNameGeneratorFunc)
		require.Equal(t, filepath.Join(testDir, pluginID), path)
		require.NoError(t, err)

		_, err = os.Stat(filepath.Join(path, "symlink_to_txt"))
		require.NoError(t, err)

		target, err := filepath.EvalSymlinks(filepath.Join(path, "symlink_to_txt"))
		require.NoError(t, err)
		require.Equal(t, filepath.Join(path, "text.txt"), target)
	})

	t.Run("Should extract directory with relative symlink", func(t *testing.T) {
		skipWindows(t)

		pluginID := "plugin-with-symlink-dir"
		path, err := fs.extractFiles(context.Background(), zipFile(t, filepath.Join("testdata", "plugin-with-symlink-dir.zip")), pluginID, SimpleDirNameGeneratorFunc)
		require.Equal(t, filepath.Join(testDir, pluginID), path)
		require.NoError(t, err)

		_, err = os.Stat(filepath.Join(path, "symlink_to_dir"))
		require.NoError(t, err)

		target, err := filepath.EvalSymlinks(filepath.Join(path, "symlink_to_dir"))
		require.NoError(t, err)
		require.Equal(t, filepath.Join(path, "dir"), target)
	})

	t.Run("Should not extract file with absolute symlink", func(t *testing.T) {
		skipWindows(t)

		pluginID := "plugin-with-absolute-symlink"
		path, err := fs.extractFiles(context.Background(), zipFile(t, filepath.Join("testdata", "plugin-with-absolute-symlink.zip")), pluginID, SimpleDirNameGeneratorFunc)
		require.Empty(t, path)
		require.ErrorContains(t, err, `symlink "test.txt" pointing outside plugin directory is not allowed`)

		_, err = os.Stat(filepath.Join(testDir, pluginID, "test.txt"))
		require.True(t, os.IsNotExist(err))
	})

	t.Run("Should not extract directory with absolute symlink", func(t *testing.T) {
		skipWindows(t)

		pluginID := "plugin-with-absolute-symlink-dir"
		path, err := fs.extractFiles(context.Background(), zipFile(t, filepath.Join("testdata", "plugin-with-absolute-symlink-dir.zip")), pluginID, SimpleDirNameGeneratorFunc)
		require.Empty(t, path)
		require.ErrorContains(t, err, `symlink "target" pointing outside plugin directory is not allowed`)

		_, err = os.Stat(filepath.Join(testDir, pluginID, "target"))
		require.True(t, os.IsNotExist(err))
	})

	t.Run("Should detect if archive members point outside of the destination directory", func(t *testing.T) {
		path, err := fs.extractFiles(context.Background(), zipFile(t, filepath.Join("testdata", "plugin-with-parent-member.zip")), "plugin-with-parent-member", SimpleDirNameGeneratorFunc)
		require.Empty(t, path)
		require.EqualError(t, err, fmt.Sprintf(
			`archive member "../member.txt" tries to write outside of plugin directory: %q, this can be a security risk`,
			testDir,
		))
	})

	t.Run("Should detect if archive members are absolute", func(t *testing.T) {
		path, err := fs.extractFiles(context.Background(), zipFile(t, filepath.Join("testdata", "plugin-with-absolute-member.zip")), "plugin-with-absolute-member", SimpleDirNameGeneratorFunc)
		require.Empty(t, path)
		require.EqualError(t, err, fmt.Sprintf(
			`archive member "/member.txt" tries to write outside of plugin directory: %q, this can be a security risk`,
			testDir,
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

func skipWindows(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping test on Windows")
	}
}

func TestExtractFilesSymlinkEscape(t *testing.T) {
	skipWindows(t)

	const pluginID = "acme-test-panel"
	const pluginJSON = `{"id":"acme-test-panel","type":"panel","name":"Acme Test Panel","info":{"version":"1.0.0"}}`

	// Each of these archives is built so that every member name, and every symlink target taken on its
	// own, stays inside the plugin directory under a lexical check. They escape only once the symlinks
	// are composed with each other.
	t.Run("Should not write through a chain of symlinks reaching the plugins directory", func(t *testing.T) {
		root := t.TempDir()
		pluginsDir := filepath.Join(root, "plugins")
		require.NoError(t, os.MkdirAll(pluginsDir, 0o750))

		victim := filepath.Join(pluginsDir, "victim.txt")
		require.NoError(t, os.WriteFile(victim, []byte("ORIGINAL"), 0o644))

		fs := FileSystem(log.NewTestPrettyLogger(), pluginsDir)
		archive := writeZip(t, filepath.Join(root, "chain.zip"), []zipEntry{
			{name: pluginID + "/plugin.json", body: pluginJSON, mode: 0o644},
			{name: pluginID + "/p/s", body: "..", mode: os.ModeSymlink | 0o777},
			{name: pluginID + "/p/t", body: "s/..", mode: os.ModeSymlink | 0o777},
			{name: pluginID + "/p/link", body: "t/victim.txt", mode: os.ModeSymlink | 0o777},
			{name: pluginID + "/p/link", body: "PWNED", mode: 0o644},
		})

		path, err := fs.extractFiles(context.Background(), archive, pluginID, SimpleDirNameGeneratorFunc)
		require.Empty(t, path)
		require.ErrorContains(t, err, "pointing outside plugin directory is not allowed")

		contents, err := os.ReadFile(victim) // nolint:gosec
		require.NoError(t, err)
		require.Equal(t, "ORIGINAL", string(contents))

		_, err = os.Stat(filepath.Join(pluginsDir, pluginID))
		require.True(t, os.IsNotExist(err), "the rejected archive left a partial install behind")
	})

	t.Run("Should not drop an executable outside the plugins directory", func(t *testing.T) {
		root := t.TempDir()
		pluginsDir := filepath.Join(root, "plugins")
		require.NoError(t, os.MkdirAll(pluginsDir, 0o750))

		fs := FileSystem(log.NewTestPrettyLogger(), pluginsDir)
		archive := writeZip(t, filepath.Join(root, "drop.zip"), []zipEntry{
			{name: pluginID + "/plugin.json", body: pluginJSON, mode: 0o644},
			{name: pluginID + "/p/a", body: "..", mode: os.ModeSymlink | 0o777},
			{name: pluginID + "/p/b", body: "a/..", mode: os.ModeSymlink | 0o777},
			{name: pluginID + "/p/c", body: "b/..", mode: os.ModeSymlink | 0o777},
			{name: pluginID + "/p/drop_linux_amd64", body: "c/dropped_linux_amd64", mode: os.ModeSymlink | 0o777},
			{name: pluginID + "/p/drop_linux_amd64", body: "#!/bin/sh\n", mode: 0o644},
		})

		path, err := fs.extractFiles(context.Background(), archive, pluginID, SimpleDirNameGeneratorFunc)
		require.Empty(t, path)
		require.ErrorContains(t, err, "pointing outside plugin directory is not allowed")

		_, err = os.Lstat(filepath.Join(root, "dropped_linux_amd64"))
		require.True(t, os.IsNotExist(err))

		_, err = os.Stat(filepath.Join(pluginsDir, pluginID))
		require.True(t, os.IsNotExist(err), "the rejected archive left a partial install behind")
	})

	// The check runs against the tree as it stands when the archive reaches each symlink, so these
	// two archives place the members that complete the escape after the symlink that relies on them.
	t.Run("Should not extract a symlink that only escapes once later members are extracted", func(t *testing.T) {
		root := t.TempDir()
		pluginsDir := filepath.Join(root, "plugins")
		require.NoError(t, os.MkdirAll(pluginsDir, 0o750))
		require.NoError(t, os.WriteFile(filepath.Join(root, "victim.txt"), []byte("OUTSIDE"), 0o644))

		fs := FileSystem(log.NewTestPrettyLogger(), pluginsDir)
		archive := writeZip(t, filepath.Join(root, "forward.zip"), []zipEntry{
			{name: pluginID + "/plugin.json", body: pluginJSON, mode: 0o644},
			// Each "." link absorbs a level of nesting, so the three ".." climb one level higher than
			// they appear to while f1 and f2 are still absent.
			{name: pluginID + "/p/link", body: "f1/f2/../../../victim.txt", mode: os.ModeSymlink | 0o777},
			{name: pluginID + "/p/f1", body: ".", mode: os.ModeSymlink | 0o777},
			{name: pluginID + "/p/f2", body: ".", mode: os.ModeSymlink | 0o777},
		})

		path, err := fs.extractFiles(context.Background(), archive, pluginID, SimpleDirNameGeneratorFunc)
		require.Empty(t, path)
		require.ErrorContains(t, err, "pointing outside plugin directory is not allowed")

		_, err = os.Stat(filepath.Join(pluginsDir, pluginID))
		require.True(t, os.IsNotExist(err), "the rejected archive left a partial install behind")
	})

	t.Run("Should not extract a symlink cycle closed by a later member", func(t *testing.T) {
		root := t.TempDir()
		pluginsDir := filepath.Join(root, "plugins")
		require.NoError(t, os.MkdirAll(pluginsDir, 0o750))

		fs := FileSystem(log.NewTestPrettyLogger(), pluginsDir)
		archive := writeZip(t, filepath.Join(root, "cycle.zip"), []zipEntry{
			{name: pluginID + "/plugin.json", body: pluginJSON, mode: 0o644},
			{name: pluginID + "/a", body: "b", mode: os.ModeSymlink | 0o777},
			{name: pluginID + "/b", body: "a", mode: os.ModeSymlink | 0o777},
		})

		path, err := fs.extractFiles(context.Background(), archive, pluginID, SimpleDirNameGeneratorFunc)
		require.Empty(t, path)
		require.ErrorContains(t, err, "exceeds the maximum symlink depth")

		_, err = os.Stat(filepath.Join(pluginsDir, pluginID))
		require.True(t, os.IsNotExist(err), "the rejected archive left a partial install behind")
	})

	t.Run("Should not extract a member that climbs out of its own plugin directory", func(t *testing.T) {
		root := t.TempDir()
		pluginsDir := filepath.Join(root, "plugins")
		require.NoError(t, os.MkdirAll(pluginsDir, 0o750))

		fs := FileSystem(log.NewTestPrettyLogger(), pluginsDir)
		archive := writeZip(t, filepath.Join(root, "sibling.zip"), []zipEntry{
			{name: pluginID + "/plugin.json", body: pluginJSON, mode: 0o644},
			{name: pluginID + "/../evil.txt", body: "PWNED", mode: 0o644},
		})

		path, err := fs.extractFiles(context.Background(), archive, pluginID, SimpleDirNameGeneratorFunc)
		require.Empty(t, path)
		require.ErrorContains(t, err, "tries to write outside of plugin directory")

		_, err = os.Lstat(filepath.Join(pluginsDir, "evil.txt"))
		require.True(t, os.IsNotExist(err))
	})
}

func TestCheckSymlinkTarget(t *testing.T) {
	skipWindows(t)

	dir := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(dir, "sub-dir"), 0o750))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "text.txt"), []byte("x"), 0o644))
	require.NoError(t, os.Symlink("..", filepath.Join(dir, "sub-dir", "up")))
	require.NoError(t, os.Symlink("/etc", filepath.Join(dir, "sub-dir", "abs")))
	require.NoError(t, os.Symlink("loop-b", filepath.Join(dir, "loop-a")))
	require.NoError(t, os.Symlink("loop-a", filepath.Join(dir, "loop-b")))

	root, err := os.OpenRoot(dir)
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, root.Close())
	})

	tcs := []struct {
		desc      string
		name      string
		target    string
		expectErr bool
	}{
		{
			desc:   "Target next to the symlink is allowed",
			name:   "sub-dir/link",
			target: "text.txt",
		},
		{
			desc:   "Target that climbs and comes back inside the plugin directory is allowed",
			name:   "sub-dir/link",
			target: "../text.txt",
		},
		{
			desc:   "Target not yet extracted is allowed",
			name:   "link",
			target: "later/file.txt",
		},
		{
			desc:      "Absolute target is rejected",
			name:      "link",
			target:    "/etc/hosts",
			expectErr: true,
		},
		{
			desc:      "Empty target is rejected",
			name:      "link",
			target:    "",
			expectErr: true,
		},
		{
			desc:      "Target climbing above the plugin directory is rejected",
			name:      "sub-dir/link",
			target:    "../../etc/hosts",
			expectErr: true,
		},
		{
			desc:      "Target composed through an already extracted symlink is rejected",
			name:      "sub-dir/link",
			target:    "up/..",
			expectErr: true,
		},
		{
			desc:      "Target resolving through an absolute symlink is rejected",
			name:      "sub-dir/link",
			target:    "abs/hosts",
			expectErr: true,
		},
		{
			desc:      "Target resolving through a symlink cycle is rejected",
			name:      "link",
			target:    "loop-a",
			expectErr: true,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			err := checkSymlinkTarget(root, tc.name, tc.target)
			if tc.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestExtractFilesArchiveIntegrity(t *testing.T) {
	const pluginID = "corrupt-test"

	root := t.TempDir()
	pluginsDir := filepath.Join(root, "plugins")
	require.NoError(t, os.MkdirAll(pluginsDir, 0o750))

	zipPath := filepath.Join(root, "corrupt.zip")
	f, err := os.Create(zipPath) // nolint:gosec
	require.NoError(t, err)

	zw := zip.NewWriter(f)
	w, err := zw.CreateHeader(&zip.FileHeader{Name: pluginID + "/plugin.json", Method: zip.Deflate})
	require.NoError(t, err)
	_, err = w.Write([]byte(`{"id":"corrupt-test","type":"panel","name":"Corrupt","info":{"version":"1.0.0"}}`))
	require.NoError(t, err)

	// CreateRaw takes the checksum from the header rather than computing it, so the entry ships a CRC
	// that does not match its bytes and the reader fails part way through the copy.
	payload := []byte("a truncated or tampered archive member")
	raw, err := zw.CreateRaw(&zip.FileHeader{
		Name:               pluginID + "/payload.txt",
		Method:             zip.Store,
		CRC32:              0xdeadbeef,
		CompressedSize64:   uint64(len(payload)),
		UncompressedSize64: uint64(len(payload)),
	})
	require.NoError(t, err)
	_, err = raw.Write(payload)
	require.NoError(t, err)

	require.NoError(t, zw.Close())
	require.NoError(t, f.Close())

	fs := FileSystem(log.NewTestPrettyLogger(), pluginsDir)
	path, err := fs.extractFiles(context.Background(), zipFile(t, zipPath), pluginID, SimpleDirNameGeneratorFunc)
	require.Empty(t, path)
	require.ErrorContains(t, err, "checksum error")

	_, err = os.Stat(filepath.Join(pluginsDir, pluginID))
	require.True(t, os.IsNotExist(err), "a corrupt archive left a partial install behind")
}

// A chain shallow enough to extract must be shallow enough for the OS to resolve, otherwise the
// archive can install a plugin whose own files cannot be read.
func TestExtractFilesSymlinkDepth(t *testing.T) {
	skipWindows(t)

	chain := func(t *testing.T, pluginID string, links int) (string, error) {
		t.Helper()

		root := t.TempDir()
		pluginsDir := filepath.Join(root, "plugins")
		require.NoError(t, os.MkdirAll(pluginsDir, 0o750))

		entries := []zipEntry{
			{name: pluginID + "/plugin.json", body: `{"id":"depth-test","type":"panel","name":"Depth","info":{"version":"1.0.0"}}`, mode: 0o644},
			{name: pluginID + "/target.txt", body: "END", mode: 0o644},
		}
		for i := 0; i < links; i++ {
			target := "target.txt"
			if i < links-1 {
				target = fmt.Sprintf("link-%02d", i+1)
			}
			entries = append(entries, zipEntry{
				name: fmt.Sprintf("%s/link-%02d", pluginID, i),
				body: target,
				mode: os.ModeSymlink | 0o777,
			})
		}

		fs := FileSystem(log.NewTestPrettyLogger(), pluginsDir)
		return fs.extractFiles(context.Background(), writeZip(t, filepath.Join(root, "chain.zip"), entries), pluginID, SimpleDirNameGeneratorFunc)
	}

	t.Run("Should extract a chain at the depth limit and leave it resolvable", func(t *testing.T) {
		path, err := chain(t, "depth-test", maxSymlinkDepth)
		require.NoError(t, err)

		target, err := filepath.EvalSymlinks(filepath.Join(path, "link-00"))
		require.NoError(t, err, "extracted a chain the OS cannot resolve")

		// The temp dir can itself sit behind a symlink, so compare canonicalised paths.
		expected, err := filepath.EvalSymlinks(filepath.Join(path, "target.txt"))
		require.NoError(t, err)
		require.Equal(t, expected, target)
	})

	t.Run("Should not extract a chain past the depth limit", func(t *testing.T) {
		path, err := chain(t, "depth-test", maxSymlinkDepth+1)
		require.Empty(t, path)
		require.ErrorContains(t, err, "exceeds the maximum symlink depth")
	})
}

func TestExtractFilesReplacesExistingInstall(t *testing.T) {
	skipWindows(t)

	const pluginID = "dangling-test"

	root := t.TempDir()
	pluginsDir := filepath.Join(root, "plugins")
	require.NoError(t, os.MkdirAll(pluginsDir, 0o750))

	// A dangling symlink is invisible to Stat, so it has to be removed on its own terms rather than
	// left for MkdirAll to trip over.
	require.NoError(t, os.Symlink(filepath.Join(root, "missing"), filepath.Join(pluginsDir, pluginID)))

	fs := FileSystem(log.NewTestPrettyLogger(), pluginsDir)
	archive := writeZip(t, filepath.Join(root, "plugin.zip"), []zipEntry{
		{name: pluginID + "/plugin.json", body: `{"id":"dangling-test","type":"panel","name":"Dangling","info":{"version":"1.0.0"}}`, mode: 0o644},
	})

	path, err := fs.extractFiles(context.Background(), archive, pluginID, SimpleDirNameGeneratorFunc)
	require.NoError(t, err)
	require.Equal(t, filepath.Join(pluginsDir, pluginID), path)

	info, err := os.Lstat(path)
	require.NoError(t, err)
	require.True(t, info.IsDir(), "the install path is still a symlink")
	require.FileExists(t, filepath.Join(path, "plugin.json"))
}

type zipEntry struct {
	name string
	body string
	mode os.FileMode
}

func writeZip(t *testing.T, zipPath string, entries []zipEntry) *zip.ReadCloser {
	t.Helper()

	f, err := os.Create(zipPath) // nolint:gosec
	require.NoError(t, err)

	zw := zip.NewWriter(f)
	for _, e := range entries {
		h := &zip.FileHeader{Name: e.name, Method: zip.Deflate}
		h.SetMode(e.mode)

		w, err := zw.CreateHeader(h)
		require.NoError(t, err)

		_, err = w.Write([]byte(e.body))
		require.NoError(t, err)
	}
	require.NoError(t, zw.Close())
	require.NoError(t, f.Close())

	return zipFile(t, zipPath)
}
