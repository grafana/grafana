package plugins

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
)

type configReader interface {
	readConfig(ctx context.Context, path string) ([]*pluginsAsConfig, error)
}

type configReaderImpl struct {
	log         log.Logger
	pluginStore plugins.Store
}

func newConfigReader(logger log.Logger, pluginStore plugins.Store) configReader {
	return &configReaderImpl{log: logger, pluginStore: pluginStore}
}

func (cr *configReaderImpl) readConfig(ctx context.Context, path string) ([]*pluginsAsConfig, error) {
	var apps []*pluginsAsConfig
	cr.log.Debug("Looking for plugin provisioning files", "path", path)

	files, err := os.ReadDir(path)
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

	err = cr.validatePluginsConfig(ctx, apps)
	if err != nil {
		return nil, err
	}

	return apps, nil
}

func (cr *configReaderImpl) parsePluginConfig(path string, file fs.DirEntry) (*pluginsAsConfig, error) {
	filename, err := filepath.Abs(filepath.Join(path, file.Name()))
	if err != nil {
		return nil, err
	}

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `filename` comes from ps.Cfg.ProvisioningPath
	yamlFile, err := os.ReadFile(filename)
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

func (cr *configReaderImpl) validatePluginsConfig(ctx context.Context, apps []*pluginsAsConfig) error {
	for i := range apps {
		if apps[i].Apps == nil {
			continue
		}

		for _, app := range apps[i].Apps {
			if _, exists := cr.pluginStore.Plugin(ctx, app.PluginID); !exists {
				return fmt.Errorf("plugin not installed: %q", app.PluginID)
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
