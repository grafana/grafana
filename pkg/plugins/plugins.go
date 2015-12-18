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
	DataSources  map[string]*DataSourcePlugin
	Panels       map[string]*PanelPlugin
	ApiPlugins   map[string]*ApiPlugin
	StaticRoutes []*StaticRootConfig
	Apps         map[string]*AppPlugin
)

type PluginScanner struct {
	pluginPath string
	errors     []error
}

func Init() error {
	DataSources = make(map[string]*DataSourcePlugin)
	ApiPlugins = make(map[string]*ApiPlugin)
	StaticRoutes = make([]*StaticRootConfig, 0)
	Panels = make(map[string]*PanelPlugin)
	Apps = make(map[string]*AppPlugin)

	scan(path.Join(setting.StaticRootPath, "app/plugins"))
	checkPluginPaths()
	checkDependencies()
	return nil
}

func checkDependencies() {
	for appType, app := range Apps {
		for _, reqPanel := range app.PanelPlugins {
			if _, ok := Panels[reqPanel]; !ok {
				log.Fatal(4, "App %s requires Panel type %s, but it is not present.", appType, reqPanel)
			}
		}
		for _, reqDataSource := range app.DatasourcePlugins {
			if _, ok := DataSources[reqDataSource]; !ok {
				log.Fatal(4, "App %s requires DataSource type %s, but it is not present.", appType, reqDataSource)
			}
		}
		for _, reqApiPlugin := range app.ApiPlugins {
			if _, ok := ApiPlugins[reqApiPlugin]; !ok {
				log.Fatal(4, "App %s requires ApiPlugin type %s, but it is not present.", appType, reqApiPlugin)
			}
		}
	}
}

func checkPluginPaths() error {
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

		DataSources[p.Type] = &p
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

		Panels[p.Type] = &p
		addStaticRoot(p.StaticRootConfig, currentDir)
	}

	if pluginType == "api" {
		p := ApiPlugin{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}
		if p.Type == "" {
			return errors.New("Did not find type property in plugin.json")
		}
		ApiPlugins[p.Type] = &p
	}

	if pluginType == "app" {
		p := AppPlugin{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}
		if p.Type == "" {
			return errors.New("Did not find type property in plugin.json")
		}
		Apps[p.Type] = &p
		addStaticRoot(p.StaticRootConfig, currentDir)
	}

	return nil
}

func GetEnabledPlugins(orgApps []*models.AppPlugin) EnabledPlugins {
	enabledPlugins := NewEnabledPlugins()

	orgAppsMap := make(map[string]*models.AppPlugin)
	for _, orgApp := range orgApps {
		orgAppsMap[orgApp.Type] = orgApp
	}
	seenPanels := make(map[string]bool)
	seenApi := make(map[string]bool)

	for appType, installedApp := range Apps {
		var app AppPlugin
		app = *installedApp

		// check if the app is stored in the DB for this org and if so, use the
		// state stored there.
		if b, ok := orgAppsMap[appType]; ok {
			app.Enabled = b.Enabled
			app.PinNavLinks = b.PinNavLinks
		}

		if app.Enabled {
			for _, d := range app.DatasourcePlugins {
				if ds, ok := DataSources[d]; ok {
					enabledPlugins.DataSourcePlugins[d] = ds
				}
			}
			for _, p := range app.PanelPlugins {
				if panel, ok := Panels[p]; ok {
					if _, ok := seenPanels[p]; !ok {
						seenPanels[p] = true
						enabledPlugins.PanelPlugins = append(enabledPlugins.PanelPlugins, panel)
					}
				}
			}
			for _, a := range app.ApiPlugins {
				if api, ok := ApiPlugins[a]; ok {
					if _, ok := seenApi[a]; !ok {
						seenApi[a] = true
						enabledPlugins.ApiPlugins = append(enabledPlugins.ApiPlugins, api)
					}
				}
			}
			enabledPlugins.AppPlugins = append(enabledPlugins.AppPlugins, &app)
		}
	}

	// add all plugins that are not part of an App.
	for d, installedDs := range DataSources {
		if installedDs.App == "" {
			enabledPlugins.DataSourcePlugins[d] = installedDs
		}
	}
	for p, panel := range Panels {
		if panel.App == "" {
			if _, ok := seenPanels[p]; !ok {
				seenPanels[p] = true
				enabledPlugins.PanelPlugins = append(enabledPlugins.PanelPlugins, panel)
			}
		}
	}
	for a, api := range ApiPlugins {
		if api.App == "" {
			if _, ok := seenApi[a]; !ok {
				seenApi[a] = true
				enabledPlugins.ApiPlugins = append(enabledPlugins.ApiPlugins, api)
			}
		}
	}

	return enabledPlugins
}
