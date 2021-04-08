package notifier

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/pkg/errors"
	"gopkg.in/yaml.v3"
)

func PersistTemplates(cfg *api.PostableUserConfig, path string) ([]string, bool, error) {
	if len(cfg.TemplateFiles) < 1 {
		return nil, false, nil
	}

	var templatesChanged bool
	pathSet := map[string]struct{}{}
	for name, content := range cfg.TemplateFiles {
		if name != filepath.Base(filepath.Clean(name)) {
			return nil, false, fmt.Errorf("template file name '%s' is not valid", name)
		}

		err := os.MkdirAll(path, 0750)
		if err != nil {
			return nil, false, fmt.Errorf("unable to create template directory %q: %s", path, err)
		}

		file := filepath.Join(path, name)
		pathSet[file] = struct{}{}

		// Check if the template file already exists and if it has changed
		// We can safeily ignore gosec here and we've previously checked the filename is clean
		// nolint:gosec
		if tmpl, err := ioutil.ReadFile(file); err == nil && string(tmpl) == content {
			// Templates file is the same we have, no-op and continue.
			continue
		} else if err != nil && !os.IsNotExist(err) {
			return nil, false, err
		}

		if err := ioutil.WriteFile(file, []byte(content), 0644); err != nil {
			return nil, false, fmt.Errorf("unable to create Alertmanager template file %q: %s", file, err)
		}
		// nolint:gosec

		templatesChanged = true
	}

	// Now that we have the list of _actual_ templates, let's remove the ones that we don't need.
	existingFiles, err := ioutil.ReadDir(path)
	if err != nil {
		log.Error("unable to read directory for deleting alertmanager templates", "err", err, "path", path)
	}
	for _, existingFile := range existingFiles {
		p := filepath.Join(path, existingFile.Name())
		_, ok := pathSet[p]
		if !ok {
			templatesChanged = true
			err := os.Remove(p)
			if err != nil {
				log.Error("unable to delete template", "err", err, "file", p)
			}
		}
	}

	paths := make([]string, 0, len(pathSet))
	for path := range pathSet {
		paths = append(paths, path)
	}
	return paths, templatesChanged, nil
}

func Load(rawConfig string) (*api.PostableUserConfig, error) {
	cfg := &api.PostableUserConfig{}

	if err := yaml.Unmarshal([]byte(rawConfig), cfg); err != nil {
		return nil, errors.Wrap(err, "unable to parse Alertmanager configuration")
	}

	// Taken from https://github.com/prometheus/alertmanager/blob/master/config/config.go#L170-L191
	// Check if we have a root route. We cannot check for it in the
	// UnmarshalYAML method because it won't be called if the input is empty
	// (e.g. the config file is empty or only contains whitespace).
	if cfg.AlertmanagerConfig.Route == nil {
		return nil, errors.New("no route provided in config")
	}

	// Check if continue in root route.
	if cfg.AlertmanagerConfig.Route.Continue {
		return nil, errors.New("cannot have continue in root route")
	}

	return cfg, nil
}
