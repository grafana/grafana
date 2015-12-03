package plugins

import (
	"encoding/json"
	"errors"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	DataSources     map[string]DataSourcePlugin
	Panels          map[string]PanelPlugin
	ExternalPlugins map[string]ExternalPlugin
	StaticRoutes    []*StaticRootConfig
	Bundles         map[string]PluginBundle
)

type PluginScanner struct {
	pluginPath string
	errors     []error
}

func Init() error {
	DataSources = make(map[string]DataSourcePlugin)
	ExternalPlugins = make(map[string]ExternalPlugin)
	StaticRoutes = make([]*StaticRootConfig, 0)
	Panels = make(map[string]PanelPlugin)
	Bundles = make(map[string]PluginBundle)

	scan(path.Join(setting.StaticRootPath, "app/plugins"))
	checkExternalPluginPaths()
	return nil
}

func checkExternalPluginPaths() error {
	for _, section := range setting.Cfg.Sections() {
		if strings.HasPrefix(section.Name(), "plugin.") {
			path := section.Key("path").String()
			if path != "" {
				log.Info("Plugin: Scaning dir %s", path)
				scan(path)
			}
		}
	}
	return nil
}

func scan(pluginDir string) error {
	scanner := &PluginScanner{
		pluginPath: pluginDir,
	}

	if err := filepath.Walk(pluginDir, scanner.walker); err != nil {
		return err
	}

	if len(scanner.errors) > 0 {
		return errors.New("Some plugins failed to load")
	}

	return nil
}

func (scanner *PluginScanner) walker(currentPath string, f os.FileInfo, err error) error {
	if err != nil {
		return err
	}

	if f.IsDir() {
		return nil
	}

	if f.Name() == "plugin.json" {
		err := scanner.loadPluginJson(currentPath)
		if err != nil {
			log.Error(3, "Failed to load plugin json file: %v,  err: %v", currentPath, err)
			scanner.errors = append(scanner.errors, err)
		}
	}
	return nil
}

func addStaticRoot(staticRootConfig *StaticRootConfig, currentDir string) {
	if staticRootConfig != nil {
		staticRootConfig.Path = path.Join(currentDir, staticRootConfig.Path)
		StaticRoutes = append(StaticRoutes, staticRootConfig)
	}
}

func (scanner *PluginScanner) loadPluginJson(pluginJsonFilePath string) error {
	currentDir := filepath.Dir(pluginJsonFilePath)
	reader, err := os.Open(pluginJsonFilePath)
	if err != nil {
		return err
	}

	defer reader.Close()

	jsonParser := json.NewDecoder(reader)

	pluginJson := make(map[string]interface{})
	if err := jsonParser.Decode(&pluginJson); err != nil {
		return err
	}

	pluginType, exists := pluginJson["pluginType"]
	if !exists {
		return errors.New("Did not find pluginType property in plugin.json")
	}

	if pluginType == "datasource" {
		p := DataSourcePlugin{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}

		if p.Type == "" {
			return errors.New("Did not find type property in plugin.json")
		}

		DataSources[p.Type] = p
		addStaticRoot(p.StaticRootConfig, currentDir)
	}

	if pluginType == "panel" {
		p := PanelPlugin{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}

		if p.Type == "" {
			return errors.New("Did not find type property in plugin.json")
		}

		Panels[p.Type] = p
		addStaticRoot(p.StaticRootConfig, currentDir)
	}

	if pluginType == "external" {
		p := ExternalPlugin{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}
		if p.Type == "" {
			return errors.New("Did not find type property in plugin.json")
		}
		ExternalPlugins[p.Type] = p
		addStaticRoot(p.StaticRootConfig, currentDir)
	}

	if pluginType == "bundle" {
		p := PluginBundle{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}
		if p.Type == "" {
			return errors.New("Did not find type property in plugin.json")
		}
		Bundles[p.Type] = p
	}

	return nil
}

func GetEnabledPlugins(bundles map[string]models.PluginBundle) EnabledPlugins {
	enabledPlugins := NewEnabledPlugins()

	for bundleType, bundle := range Bundles {
		enabled := bundle.Enabled
		// check if the bundle is stored in the DB.
		if b, ok := bundles[bundleType]; ok {
			enabled = b.Enabled
		}

		if enabled {
			for _, d := range bundle.DatasourcePlugins {
				if ds, ok := DataSources[d]; ok {
					enabledPlugins.DataSourcePlugins[d] = &ds
				}
			}
			for _, p := range bundle.PanelPlugins {
				if panel, ok := Panels[p]; ok {
					enabledPlugins.PanelPlugins = append(enabledPlugins.PanelPlugins, &panel)
				}
			}
			for _, e := range bundle.ExternalPlugins {
				if external, ok := ExternalPlugins[e]; ok {
					enabledPlugins.ExternalPlugins = append(enabledPlugins.ExternalPlugins, &external)
				}
			}
		}
	}
	return enabledPlugins
}
