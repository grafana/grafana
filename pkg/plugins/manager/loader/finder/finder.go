package finder

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	fsUtil "github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
)

var walk = util.Walk

type Finder struct {
	log log.Logger

	errs map[string]finderErr
}

type finderErr struct {
	path string
	err  error
}

func (f finderErr) Error() string {
	return fmt.Sprintf("plugin finder err %v for path: %s", f.err, f.path)
}

func New() Finder {
	return Finder{log: log.New("plugin.finder"), errs: make(map[string]finderErr)}
}

func (f *Finder) Find(pluginPaths []string) ([]string, error) {
	pluginJSONPaths := make(map[string]struct{})

	for _, path := range pluginPaths {
		exists, err := fsUtil.Exists(path)
		if err != nil {
			f.log.Warn("Error occurred when checking if plugin directory exists", "path", path, "err", err)
		}
		if !exists {
			f.log.Warn("Skipping finding plugins as directory does not exist", "path", path)
			continue
		}

		paths, err := f.getAbsPluginJSONPaths(path)
		if err != nil {
			return nil, err
		}
		for _, p := range paths {
			pluginJSONPaths[p] = struct{}{}
		}
	}

	for _, findErr := range f.errs {
		for pluginJSONPath := range pluginJSONPaths {
			pluginDir := filepath.Dir(pluginJSONPath)
			p, err := filepath.Rel(pluginDir, findErr.path)
			if err != nil {
				f.log.Warn("Could not calculate relative path", "base", pluginDir, "target", findErr.path, "err", err)
				continue
			}
			if p == ".." || strings.HasPrefix(p, ".."+string(filepath.Separator)) {
				continue
			} else {
				delete(pluginJSONPaths, pluginJSONPath)
			}
		}
	}

	var res []string
	for path := range pluginJSONPaths {
		res = append(res, path)
	}
	return res, nil
}

func (f *Finder) getAbsPluginJSONPaths(path string) ([]string, error) {
	var pluginJSONPaths []string

	var err error
	path, err = filepath.Abs(path)
	if err != nil {
		return []string{}, err
	}

	if err = walk(path, true, true,
		func(currentPath string, fi os.FileInfo, err error) error {
			if err != nil {
				if errors.Is(err, os.ErrNotExist) {
					f.log.Error("Couldn't scan directory since it doesn't exist", "pluginDir", path, "err", err)
					return nil
				}
				if errors.Is(err, os.ErrPermission) {
					f.log.Error("Couldn't scan directory due to lack of permissions", "pluginDir", path, "err", err)
					return nil
				}

				return fmt.Errorf("filepath.Walk reported an error for %q: %w", currentPath, err)
			}

			// verify if is valid symlink
			if fi.Mode()&os.ModeSymlink == os.ModeSymlink {
				_, err = os.Stat(currentPath)
				if err != nil {
					if errors.Is(err, fs.ErrNotExist) {
						f.log.Error("Invalid plugin symlink file", "pluginDir", path, "err", err)
						f.errs[path] = finderErr{path: filepath.Clean(currentPath), err: err}
						return util.ErrWalkSkipSymlink
					}
					return err
				}
			}

			if fi.Name() == "node_modules" {
				return util.ErrWalkSkipDir
			}

			if fi.IsDir() {
				return nil
			}

			if fi.Name() != "plugin.json" {
				return nil
			}

			pluginJSONPaths = append(pluginJSONPaths, currentPath)
			return nil
		}); err != nil {
		return []string{}, err
	}
	return pluginJSONPaths, nil
}
