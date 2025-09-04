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
		// Ensure installed plugin directory inherits ownership from parent plugin dir.
	// Do not fail extraction on error; just warn.
	if err := matchOwnershipToParent(pluginDir, fs.pluginsDir); err != nil {
		fs.log.Warn("Failed to set plugin ownership", "path", pluginDir, "err", err)
	}


	return &ExtractedPluginArchive{
		ID:           pluginJSON.ID,
		Version:      pluginJSON.Info.Version,
		Dependencies: deps,
		Path:         pluginDir,
	}, nil
}

func (fs *FS) extractFiles(_ context.Context, pluginArchive *zip.ReadCloser, pluginID string, dirNameFunc DirNameGeneratorFunc) (string, error) {
	pluginDirName := dirNameFunc(pluginID)
	installDir := filepath.Join(fs.pluginsDir, pluginDirName)
	if _, err := os.Stat(installDir); !os.IsNotExist(err) {
		fs.log.Debugf("Removing existing installation of plugin %s", installDir)
		err = os.RemoveAll(installDir)
		if err != nil {
			return "", err
		}
	}

	defer func() {
		if err := pluginArchive.Close(); err != nil {
			fs.log.Warn("Failed to close zip file", "error", err)
		}
	}()

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

		dstPath := filepath.Clean(filepath.Join(fs.pluginsDir, removeGitBuildFromName(zf.Name, pluginDirName))) // lgtm[go/zipslip]

		if zf.FileInfo().IsDir() {
			// We can ignore gosec G304 here since it makes sense to give all users read access
			// nolint:gosec
			if err := os.MkdirAll(dstPath, 0755); err != nil {
				if os.IsPermission(err) {
					return "", ErrPermissionDenied{Path: dstPath}
				}

				return "", err
			}
			continue
		}

		// Create needed directories to extract file
		// We can ignore gosec G304 here since it makes sense to give all users read access
		// nolint:gosec
		if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
			return "", fmt.Errorf("%v: %w", "failed to create directory to extract plugin files", err)
		}

		if isSymlink(zf) {
			if err := extractSymlink(installDir, zf, dstPath); err != nil {
				fs.log.Warn("Failed to extract symlink", "error", err)
				continue
			}
			continue
		}

		if err := extractFile(zf, dstPath); err != nil {
			return "", fmt.Errorf("%v: %w", "failed to extract file", err)
		}
	}

	return installDir, nil
}

func isSymlink(file *zip.File) bool {
	return file.Mode()&os.ModeSymlink == os.ModeSymlink
}

func extractSymlink(basePath string, file *zip.File, filePath string) error {
	// symlink target is the contents of the file
	src, err := file.Open()
	if err != nil {
		return fmt.Errorf("%v: %w", "failed to extract file", err)
	}
	buf := new(bytes.Buffer)
	if _, err = io.Copy(buf, src); err != nil {
		return fmt.Errorf("%v: %w", "failed to copy symlink contents", err)
	}

	symlinkPath := strings.TrimSpace(buf.String())
	if !isSymlinkRelativeTo(basePath, symlinkPath, filePath) {
		return fmt.Errorf("symlink %q pointing outside plugin directory is not allowed", filePath)
	}

	if err = os.Symlink(symlinkPath, filePath); err != nil {
		return fmt.Errorf("failed to make symbolic link for %v: %w", filePath, err)
	}
	return nil
}

// isSymlinkRelativeTo checks whether symlinkDestPath is relative to basePath.
// symlinkOrigPath is the path to file holding the symbolic link.
func isSymlinkRelativeTo(basePath string, symlinkDestPath string, symlinkOrigPath string) bool {
	if filepath.IsAbs(symlinkDestPath) {
		return false
	}
	fileDir := filepath.Dir(symlinkOrigPath)
	cleanPath := filepath.Clean(filepath.Join(fileDir, symlinkDestPath))
	p, err := filepath.Rel(basePath, cleanPath)
	if err != nil {
		return false
	}

	if strings.HasPrefix(filepath.Clean(p), "..") {
		return false
	}

	return true
}

func extractFile(file *zip.File, filePath string) (err error) {
	fileMode := file.Mode()
	// This is entry point for backend plugins so we want to make them executable
	if strings.HasSuffix(filePath, "_linux_amd64") || strings.HasSuffix(filePath, "_linux_arm") || strings.HasSuffix(filePath, "_linux_arm64") || strings.HasSuffix(filePath, "_darwin_amd64") || strings.HasSuffix(filePath, "_darwin_arm64") || strings.HasSuffix(filePath, "_windows_amd64.exe") {
		fileMode = os.FileMode(0755)
	}

	// We can ignore the gosec G304 warning on this one, since the variable part of the file path stems
	// from command line flag "pluginsDir", and the only possible damage would be writing to the wrong directory.
	// If the user shouldn't be writing to this directory, they shouldn't have the permission in the file system.
	// nolint:gosec
	dst, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, fileMode)
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
		err = dst.Close()
	}()

	src, err := file.Open()
	if err != nil {
		return fmt.Errorf("%v: %w", "failed to extract file", err)
	}
	defer func() {
		err = src.Close()
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
