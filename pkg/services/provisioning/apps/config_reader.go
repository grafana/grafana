package apps

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
	readConfig(path string) ([]*appsAsConfig, error)
}

type configReaderImpl struct {
	log log.Logger
}

func newConfigReader(logger log.Logger) configReader {
	return &configReaderImpl{log: logger}
}

func (cr *configReaderImpl) readConfig(path string) ([]*appsAsConfig, error) {
	var apps []*appsAsConfig
	cr.log.Debug("Looking for app provisioning files", "path", path)

	files, err := ioutil.ReadDir(path)
	if err != nil {
		cr.log.Error("Failed to read app provisioning files from directory", "path", path, "error", err)
		return apps, nil
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".yaml") || strings.HasSuffix(file.Name(), ".yml") {
			cr.log.Debug("Parsing app provisioning file", "path", path, "file.Name", file.Name())
			app, err := cr.parseAppConfig(path, file)
			if err != nil {
				return nil, err
			}

			if app != nil {
				apps = append(apps, app)
			}
		}
	}

	cr.log.Debug("Validating apps")
	if err := validateRequiredField(apps); err != nil {
		return nil, err
	}

	checkOrgIDAndOrgName(apps)

	err = validateApps(apps)
	if err != nil {
		return nil, err
	}

	return apps, nil
}

func (cr *configReaderImpl) parseAppConfig(path string, file os.FileInfo) (*appsAsConfig, error) {
	filename, _ := filepath.Abs(filepath.Join(path, file.Name()))
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var cfg *appsAsConfigV0
	err = yaml.Unmarshal(yamlFile, &cfg)
	if err != nil {
		return nil, err
	}

	return cfg.mapToAppsFromConfig(), nil
}

func validateRequiredField(apps []*appsAsConfig) error {
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

func validateApps(apps []*appsAsConfig) error {
	for i := range apps {
		if apps[i].Apps == nil {
			continue
		}

		for _, app := range apps[i].Apps {
			if !plugins.IsAppInstalled(app.PluginID) {
				return fmt.Errorf("plugin not installed: %s", app.PluginID)
			}
		}
	}

	return nil
}

func checkOrgIDAndOrgName(apps []*appsAsConfig) {
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
