package filestore

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/plugins/logger"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	reGitBuild = regexp.MustCompile("^[a-zA-Z0-9_.-]*/")
)

type Service struct {
	log logger.Logger
}

func New(logger logger.Logger) *Service {
	return &Service{
		log: logger,
	}
}

func ProvideService() *Service {
	return New(logger.NewLogger("plugin.fs", true))
}

func (s *Service) Add(ctx context.Context, pluginArchive *zip.ReadCloser, pluginID, pluginsPath string) (
	*ExtractedPluginArchive, error) {
	pluginDir, err := s.extractFiles(ctx, pluginArchive, pluginID, pluginsPath)
	if err != nil {
		return nil, errutil.Wrap("failed to extract plugin archive", err)
	}

	res, err := toPluginDTO(pluginID, pluginDir)
	if err != nil {
		return nil, errutil.Wrap("failed to convert to plugin DTO", err)
	}

	s.log.Successf("Downloaded and extracted %s v%s zip successfully to %s", res.ID, res.Info.Version, pluginDir)

	var deps []*Dependency
	for _, plugin := range res.Dependencies.Plugins {
		deps = append(deps, &Dependency{
			ID:      plugin.ID,
			Version: plugin.Version,
		})
	}

	return &ExtractedPluginArchive{
		ID:           res.ID,
		Version:      res.Info.Version,
		Dependencies: deps,
		Path:         pluginDir,
	}, nil
}

func (s *Service) Remove(_ context.Context, pluginDir string) error {
	// verify it's a plugin directory
	if _, err := os.Stat(filepath.Join(pluginDir, "plugin.json")); err != nil {
		if os.IsNotExist(err) {
			if _, err := os.Stat(filepath.Join(pluginDir, "dist", "plugin.json")); err != nil {
				if os.IsNotExist(err) {
					return fmt.Errorf("tried to remove %s, but it doesn't seem to be a plugin", pluginDir)
				}
			}
		}
	}

	s.log.Infof("Uninstalling plugin %v", pluginDir)

	return os.RemoveAll(pluginDir)
}

func (s *Service) extractFiles(_ context.Context, pluginArchive *zip.ReadCloser, pluginID, destPath string) (string, error) {
	installDir := filepath.Join(destPath, pluginID)
	if _, err := os.Stat(installDir); !os.IsNotExist(err) {
		s.log.Debugf("Removing existing installation of plugin %s", installDir)
		err = os.RemoveAll(installDir)
		if err != nil {
			return "", err
		}
	}

	defer func() {
		if err := pluginArchive.Close(); err != nil {
			s.log.Warn("failed to close zip file", "err", err)
		}
	}()

	for _, zf := range pluginArchive.File {
		// We can ignore gosec G305 here since we check for the ZipSlip vulnerability below
		// nolint:gosec
		fullPath := filepath.Join(destPath, zf.Name)

		// Check for ZipSlip. More Info: http://bit.ly/2MsjAWE
		if filepath.IsAbs(zf.Name) ||
			!strings.HasPrefix(fullPath, filepath.Clean(destPath)+string(os.PathSeparator)) ||
			strings.HasPrefix(zf.Name, ".."+string(os.PathSeparator)) {
			return "", fmt.Errorf(
				"archive member %q tries to write outside of plugin directory: %q, this can be a security risk",
				zf.Name, destPath)
		}

		dstPath := filepath.Clean(filepath.Join(destPath, removeGitBuildFromName(zf.Name, pluginID)))

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
			return "", errutil.Wrap("failed to create directory to extract plugin files", err)
		}

		if isSymlink(zf) {
			if !allowSymlink(pluginID) {
				s.log.Warn("%v: plugin archive contains a symlink, which is not allowed. Skipping", zf.Name)
				continue
			}
			if err := extractSymlink(zf, dstPath); err != nil {
				s.log.Warn("failed to extract symlink", "err", err)
				continue
			}
		} else if err := extractFile(zf, dstPath); err != nil {
			return "", errutil.Wrap("failed to extract file", err)
		}
	}

	return installDir, nil
}

func isSymlink(file *zip.File) bool {
	return file.Mode()&os.ModeSymlink == os.ModeSymlink
}

func extractSymlink(file *zip.File, filePath string) error {
	// symlink target is the contents of the file
	src, err := file.Open()
	if err != nil {
		return errutil.Wrap("failed to extract file", err)
	}
	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, src); err != nil {
		return errutil.Wrap("failed to copy symlink contents", err)
	}
	if err := os.Symlink(strings.TrimSpace(buf.String()), filePath); err != nil {
		return errutil.Wrapf(err, "failed to make symbolic link for %v", filePath)
	}
	return nil
}

func extractFile(file *zip.File, filePath string) (err error) {
	fileMode := file.Mode()
	// This is entry point for backend plugins so we want to make them executable
	if strings.HasSuffix(filePath, "_linux_amd64") || strings.HasSuffix(filePath, "_darwin_amd64") {
		fileMode = os.FileMode(0755)
	}

	// We can ignore the gosec G304 warning on this one, since the variable part of the file path stems
	// from command line flag "destPath", and the only possible damage would be writing to the wrong directory.
	// If the user shouldn't be writing to this directory, they shouldn't have the permission in the file system.
	// nolint:gosec
	dst, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, fileMode)
	if err != nil {
		if os.IsPermission(err) {
			return ErrPermissionDenied{Path: filePath}
		}

		unwrappedError := errors.Unwrap(err)
		if unwrappedError != nil && strings.EqualFold(unwrappedError.Error(), "text file busy") {
			return fmt.Errorf("file %q is in use - please stop Grafana, install the plugin and restart Grafana", filePath)
		}

		return errutil.Wrap("failed to open file", err)
	}
	defer func() {
		err = dst.Close()
	}()

	src, err := file.Open()
	if err != nil {
		return errutil.Wrap("failed to extract file", err)
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

func toPluginDTO(pluginID, pluginDir string) (*InstalledPlugin, error) {
	distPluginDataPath := filepath.Join(pluginDir, "dist", "plugin.json")

	// It's safe to ignore gosec warning G304 since the file path suffix is hardcoded
	// nolint:gosec
	data, err := ioutil.ReadFile(distPluginDataPath)
	if err != nil {
		pluginDataPath := filepath.Join(pluginDir, "plugin.json")
		// It's safe to ignore gosec warning G304 since the file path suffix is hardcoded
		// nolint:gosec
		data, err = ioutil.ReadFile(pluginDataPath)
		if err != nil {
			return nil, fmt.Errorf("could not find dist/plugin.json or plugin.json for %s in %s", pluginID, pluginDir)
		}
	}

	res := &InstalledPlugin{}
	if err := json.Unmarshal(data, &res); err != nil {
		return res, err
	}

	if res.ID == "" {
		return nil, fmt.Errorf("could not find valid plugin %s in %s", pluginID, pluginDir)
	}

	if res.Info.Version == "" {
		res.Info.Version = "0.0.0"
	}

	return res, nil
}

func allowSymlink(pluginID string) bool {
	return strings.HasPrefix(pluginID, "grafana-")
}
