package storage

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

var _ ZipExtractor = (*FS)(nil)

var reGitBuild = regexp.MustCompile("^[a-zA-Z0-9_.-]*/")

// maxSymlinkDepth bounds how many links a symlink target may resolve through, counting the symlink
// itself. It stops a cycle in the archive from spinning forever, and is deliberately well below the
// kernel limits (40 on Linux, 32 on Darwin) so that a chain shallow enough to extract is always
// shallow enough for the OS to resolve afterwards. No real plugin chains links more than one deep.
const maxSymlinkDepth = 16

type FS struct {
	pluginsDir string
	log        log.PrettyLogger
}

func FileSystem(logger log.PrettyLogger, pluginsDir string) *FS {
	return &FS{
		pluginsDir: pluginsDir,
		log:        logger,
	}
}

var SimpleDirNameGeneratorFunc = func(pluginID string) string {
	return pluginID
}

func (fs *FS) Extract(ctx context.Context, pluginID string, dirNameFunc DirNameGeneratorFunc, pluginArchive *zip.ReadCloser) (
	*ExtractedPluginArchive, error) {
	pluginDir, err := fs.extractFiles(ctx, pluginArchive, pluginID, dirNameFunc)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to extract plugin archive", err)
	}

	pluginJSON, err := readPluginJSON(pluginDir)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to convert to plugin DTO", err)
	}

	fs.log.Successf("Downloaded and extracted %s v%s zip successfully to %s", pluginJSON.ID, pluginJSON.Info.Version, pluginDir)

	deps := make([]*Dependency, 0, len(pluginJSON.Dependencies.Plugins))
	for _, plugin := range pluginJSON.Dependencies.Plugins {
		deps = append(deps, &Dependency{
			ID: plugin.ID,
		})
	}

	return &ExtractedPluginArchive{
		ID:           pluginJSON.ID,
		Version:      pluginJSON.Info.Version,
		Dependencies: deps,
		Path:         pluginDir,
	}, nil
}

func (fs *FS) extractFiles(_ context.Context, pluginArchive *zip.ReadCloser, pluginID string, dirNameFunc DirNameGeneratorFunc) (pluginDir string, err error) {
	pluginDirName := dirNameFunc(pluginID)
	installDir := filepath.Join(fs.pluginsDir, pluginDirName)
	if _, lstatErr := os.Lstat(installDir); !os.IsNotExist(lstatErr) {
		fs.log.Debugf("Removing existing installation of plugin %s", installDir)
		if err := os.RemoveAll(installDir); err != nil {
			return "", err
		}
	}

	defer func() {
		if err := pluginArchive.Close(); err != nil {
			fs.log.Warn("Failed to close zip file", "error", err)
		}
	}()

	// We can ignore gosec G301 here since it makes sense to give all users read access
	// nolint:gosec
	if err := os.MkdirAll(installDir, 0755); err != nil {
		if os.IsPermission(err) {
			return "", ErrPermissionDenied{Path: installDir}
		}

		return "", err
	}

	// A rejected archive leaves nothing behind: whatever was extracted before the offending member is
	// content the archive chose, and the plugin is not installable without the rest of it anyway.
	defer func() {
		if err != nil {
			if rmErr := os.RemoveAll(installDir); rmErr != nil {
				fs.log.Warn("Failed to remove partially extracted plugin", "path", installDir, "error", rmErr)
			}
		}
	}()

	// Every write below goes through root, which refuses any path that leaves installDir, whether
	// lexically or by following a symlink the archive itself extracted. Checking the archive member
	// names alone is not enough: a name carrying no ".." can still resolve outside the directory once
	// an earlier member has planted a symlink along its path.
	root, err := os.OpenRoot(installDir)
	if err != nil {
		return "", err
	}
	defer func() {
		if err := root.Close(); err != nil {
			fs.log.Warn("Failed to close plugin directory", "error", err)
		}
	}()

	// Paths of the symlinks extracted, for the final check below.
	var symlinks []string

	for _, zf := range pluginArchive.File {
		// We can ignore gosec G305 here since we check for the ZipSlip vulnerability below
		// nolint:gosec
		fullPath := filepath.Join(fs.pluginsDir, zf.Name)

		// Check for ZipSlip. More Info: http://bit.ly/2MsjAWE
		if filepath.IsAbs(zf.Name) ||
			!strings.HasPrefix(fullPath, filepath.Clean(fs.pluginsDir)+string(os.PathSeparator)) ||
			strings.HasPrefix(zf.Name, ".."+string(os.PathSeparator)) {
			return "", fmt.Errorf(
				"archive member %q tries to write outside of plugin directory: %q, this can be a security risk",
				zf.Name, fs.pluginsDir)
		}

		dstPath, relErr := installRelPath(fs.pluginsDir, installDir, removeGitBuildFromName(zf.Name, pluginDirName))
		if relErr != nil {
			return "", fmt.Errorf(
				"archive member %q tries to write outside of plugin directory: %q, this can be a security risk",
				zf.Name, installDir)
		}

		if dstPath == "." {
			if zf.FileInfo().IsDir() {
				continue
			}

			return "", fmt.Errorf("archive member %q would replace the plugin directory %q", zf.Name, installDir)
		}

		if zf.FileInfo().IsDir() {
			// We can ignore gosec G301 here since it makes sense to give all users read access
			// nolint:gosec
			if err := root.MkdirAll(dstPath, 0755); err != nil {
				if os.IsPermission(err) {
					return "", ErrPermissionDenied{Path: filepath.Join(installDir, dstPath)}
				}

				return "", err
			}
			continue
		}

		// Create needed directories to extract file
		// We can ignore gosec G301 here since it makes sense to give all users read access
		// nolint:gosec
		if err := root.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
			return "", fmt.Errorf("%v: %w", "failed to create directory to extract plugin files", err)
		}

		if isSymlink(zf) {
			// A symlink that cannot be extracted safely aborts the install rather than being skipped:
			// carrying on would leave the plugin half-extracted, in a shape the archive chose.
			if err := extractSymlink(root, zf, dstPath); err != nil {
				return "", fmt.Errorf("%v: %w", "failed to extract symlink", err)
			}
			symlinks = append(symlinks, dstPath)
			continue
		}

		if err := extractFile(root, zf, dstPath); err != nil {
			return "", fmt.Errorf("%v: %w", "failed to extract file", err)
		}
	}

	// A symlink is checked against the tree as it stood when the archive reached it, so a member
	// extracted later can still change what an earlier symlink resolves to: a link to "." planted
	// after the fact absorbs one level of nesting, which lets a trailing ".." in the earlier target
	// climb a level higher than it appeared to. Re-check every symlink now that the archive is fully
	// extracted and nothing more can move underneath them.
	for _, name := range symlinks {
		target, readErr := root.Readlink(name)
		if readErr != nil {
			return "", fmt.Errorf("failed to read back symlink %q: %w", name, readErr)
		}

		if err := checkSymlinkTarget(root, name, target); err != nil {
			return "", fmt.Errorf("%v: %w", "failed to extract symlink", err)
		}
	}

	return installDir, nil
}

// installRelPath maps an archive member name onto a path relative to installDir, the form the
// os.Root methods take. Member names are resolved against pluginsDir to preserve the historical
// layout, so a name that climbs out of its own plugin directory is rejected here.
func installRelPath(pluginsDir, installDir, name string) (string, error) {
	rel, err := filepath.Rel(installDir, filepath.Clean(filepath.Join(pluginsDir, name)))
	if err != nil {
		return "", err
	}

	if rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("%q resolves outside of %q", name, installDir)
	}

	return rel, nil
}

func isSymlink(file *zip.File) bool {
	return file.Mode()&os.ModeSymlink == os.ModeSymlink
}

func extractSymlink(root *os.Root, file *zip.File, name string) error {
	// symlink target is the contents of the file
	src, err := file.Open()
	if err != nil {
		return fmt.Errorf("%v: %w", "failed to extract file", err)
	}
	defer func() {
		_ = src.Close()
	}()

	buf := new(bytes.Buffer)
	if _, err = io.Copy(buf, src); err != nil {
		return fmt.Errorf("%v: %w", "failed to copy symlink contents", err)
	}

	target := strings.TrimSpace(buf.String())
	if err := checkSymlinkTarget(root, name, target); err != nil {
		return err
	}

	if err = root.Symlink(target, name); err != nil {
		return fmt.Errorf("failed to make symbolic link for %v: %w", name, err)
	}
	return nil
}

// checkSymlinkTarget reports whether the symlink extracted to name may point at target, where both
// are relative to root. Resolution expands every component through the links already extracted,
// because a lexical check cannot see them: "s/.." cleans to "." even when "s" is a symlink pointing
// somewhere else entirely, so links that each pass a lexical check can still compose into an escape.
// os.Root refuses to write through such a chain, and this keeps one from being created at all, since
// the extracted tree is later read by code that resolves paths itself.
func checkSymlinkTarget(root *os.Root, name, target string) error {
	if target == "" {
		return fmt.Errorf("symlink %q has an empty target", name)
	}

	if isRootedPath(target) {
		return fmt.Errorf("symlink %q pointing outside plugin directory is not allowed: %q is not relative to it", name, target)
	}

	// The link's own directory is resolved alongside the target: its components may be symlinks too.
	pending := append(splitPath(filepath.Dir(name)), splitPath(target)...)
	resolved := make([]string, 0, len(pending))

	// name is itself the first link in the chain, so it counts against the budget.
	depth := 1

	for len(pending) > 0 {
		component := pending[0]
		pending = pending[1:]

		switch component {
		case "", ".":
			continue
		case "..":
			if len(resolved) == 0 {
				return fmt.Errorf("symlink %q pointing outside plugin directory is not allowed: %q escapes", name, target)
			}
			resolved = resolved[:len(resolved)-1]
			continue
		}

		next := filepath.Join(filepath.Join(resolved...), component)
		nested, err := root.Readlink(next)
		if err != nil {
			// Readlink fails when next is not a symlink, or does not exist yet. Either way it cannot
			// redirect the rest of the path, so it is an ordinary component. Anything extracted there
			// later is a symlink that passed this same check.
			resolved = append(resolved, component)
			continue
		}

		depth++
		if depth > maxSymlinkDepth {
			return fmt.Errorf("symlink %q exceeds the maximum symlink depth of %d", name, maxSymlinkDepth)
		}

		if isRootedPath(nested) {
			return fmt.Errorf("symlink %q pointing outside plugin directory is not allowed: %q resolves through %q, which is not relative to it", name, target, next)
		}

		pending = append(splitPath(nested), pending...)
	}

	return nil
}

// isRootedPath reports whether p is anchored somewhere other than the directory it sits in, so
// resolving it would not stay under the plugin directory. Beyond an absolute path this covers a
// POSIX-absolute target on Windows, and the Windows drive-relative and UNC forms ("C:foo",
// `\\server\share`), which filepath.IsAbs does not consider absolute.
func isRootedPath(p string) bool {
	return filepath.IsAbs(p) || strings.HasPrefix(p, "/") || filepath.VolumeName(p) != ""
}

// splitPath splits a relative path into its components without cleaning it, so that ".." elements
// survive to be resolved against what the preceding components actually point at.
func splitPath(p string) []string {
	if p == "" {
		return nil
	}

	return strings.Split(filepath.ToSlash(p), "/")
}

func extractFile(root *os.Root, file *zip.File, name string) (err error) {
	filePath := filepath.Join(root.Name(), name)

	fileMode := file.Mode()
	// This is entry point for backend plugins so we want to make them executable
	if strings.HasSuffix(name, "_linux_amd64") || strings.HasSuffix(name, "_linux_arm") || strings.HasSuffix(name, "_linux_arm64") || strings.HasSuffix(name, "_darwin_amd64") || strings.HasSuffix(name, "_darwin_arm64") || strings.HasSuffix(name, "_windows_amd64.exe") {
		fileMode = os.FileMode(0755)
	}

	dst, err := root.OpenFile(name, os.O_RDWR|os.O_CREATE|os.O_TRUNC, fileMode)
	if err != nil {
		if os.IsPermission(err) {
			return fmt.Errorf("could not create %q, permission denied, make sure you have write access to plugin dir", filePath)
		}

		unwrappedError := errors.Unwrap(err)
		if unwrappedError != nil && strings.EqualFold(unwrappedError.Error(), "text file busy") {
			return fmt.Errorf("file %q is in use - please stop Grafana, install the plugin and restart Grafana", filePath)
		}

		return fmt.Errorf("%v: %w", "failed to open file", err)
	}
	defer func() {
		// Only report a close failure when the extraction itself succeeded: the copy error below is
		// the one that says the archive member did not come out intact, and a CRC mismatch surfaces
		// there rather than at close.
		if closeErr := dst.Close(); closeErr != nil && err == nil {
			err = closeErr
		}
	}()

	src, err := file.Open()
	if err != nil {
		return fmt.Errorf("%v: %w", "failed to extract file", err)
	}
	defer func() {
		if closeErr := src.Close(); closeErr != nil && err == nil {
			err = closeErr
		}
	}()

	_, err = io.Copy(dst, src)
	return err
}

func removeGitBuildFromName(filename, pluginID string) string {
	return reGitBuild.ReplaceAllString(filename, pluginID+"/")
}

func readPluginJSON(pluginDir string) (plugins.JSONData, error) {
	pluginPath := filepath.Join(pluginDir, "plugin.json")

	// It's safe to ignore gosec warning G304 since the file path suffix is hardcoded
	// nolint:gosec
	data, err := os.ReadFile(pluginPath)
	if err != nil {
		pluginPath = filepath.Join(pluginDir, "dist", "plugin.json")
		// It's safe to ignore gosec warning G304 since the file path suffix is hardcoded
		// nolint:gosec
		data, err = os.ReadFile(pluginPath)
		if err != nil {
			return plugins.JSONData{}, fmt.Errorf("could not find plugin.json or dist/plugin.json in %s", pluginDir)
		}
	}

	pJSON, err := plugins.ReadPluginJSON(bytes.NewReader(data))
	if err != nil {
		return plugins.JSONData{}, err
	}

	return pJSON, nil
}
