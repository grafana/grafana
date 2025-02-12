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
			ID:      plugin.ID,
			Version: plugin.Version,
		})
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
	// Er don't need the rest when running data sources in api server locally
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
