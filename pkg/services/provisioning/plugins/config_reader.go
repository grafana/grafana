package plugins

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"gopkg.in/yaml.v2"
)

type configReader interface {
	readConfig(path string) ([]*pluginsAsConfig, error)
}

type configReaderImpl struct {
	log log.Logger
}

func newConfigReader(logger log.Logger) configReader {
	return &configReaderImpl{log: logger}
}

func (cr *configReaderImpl) readConfig(path string) ([]*pluginsAsConfig, error) {
	var apps []*pluginsAsConfig
	cr.log.Debug("Looking for plugin provisioning files", "path", path)

	files, err := ioutil.ReadDir(path)
	if err != nil {
		cr.log.Error("Failed to read plugin provisioning files from directory", "path", path, "error", err)
		return apps, nil
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".yaml") || strings.HasSuffix(file.Name(), ".yml") {
			cr.log.Debug("Parsing plugin provisioning file", "path", path, "file.Name", file.Name())
			app, err := cr.parsePluginConfig(path, file)
			if err != nil {
				return nil, err
			}

			if app != nil {
				apps = append(apps, app)
			}
		}
	}

	cr.log.Debug("Validating plugins")
	if err := validateRequiredField(apps); err != nil {
		return nil, err
	}

	checkOrgIDAndOrgName(apps)

	err = validatePluginsConfig(apps)
	if err != nil {
		return nil, err
	}

	return apps, nil
}

func (cr *configReaderImpl) parsePluginConfig(path string, file os.FileInfo) (*pluginsAsConfig, error) {
	filename, err := filepath.Abs(filepath.Join(path, file.Name()))
	if err != nil {
		return nil, err
	}

	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var cfg *pluginsAsConfigV0
	err = yaml.Unmarshal(yamlFile, &cfg)
	if err != nil {
		return nil, err
	}

	return cfg.mapToPluginsFromConfig(), nil
}

func validateRequiredField(apps []*pluginsAsConfig) error {
	for i := range apps {
		var errStrings []string
		for index, app := range apps[i].Apps {
			if app.PluginID == "" {
				errStrings = append(
					errStrings,
					fmt.Sprintf("app item %d in configuration doesn't contain required field type", index+1),
				)
			}
		}

		if len(errStrings) != 0 {
			return fmt.Errorf(strings.Join(errStrings, "\n"))
		}
	}

	return nil
}

func validatePluginsConfig(apps []*pluginsAsConfig) error {
	for i := range apps {
		if apps[i].Apps == nil {
			continue
		}

		for _, app := range apps[i].Apps {
			if !plugins.IsAppInstalled(app.PluginID) {
				return fmt.Errorf("app plugin not installed: %s", app.PluginID)
			}
		}
	}

	return nil
}

func checkOrgIDAndOrgName(apps []*pluginsAsConfig) {
	for i := range apps {
		for _, app := range apps[i].Apps {
			if app.OrgID < 1 {
				if app.OrgName == "" {
					app.OrgID = 1
				} else {
					app.OrgID = 0
				}
			}
		}
	}
}
