package plugins

import (
	"encoding/json"
	"errors"
	"os"
	"path"
	"path/filepath"
	"reflect"
	"strings"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	DataSources  map[string]*DataSourcePlugin
	Panels       map[string]*PanelPlugin
	StaticRoutes []*PluginStaticRoute
	Apps         map[string]*AppPlugin
	PluginTypes  map[string]interface{}
)

type PluginScanner struct {
	pluginPath string
	errors     []error
}

func Init() error {
	DataSources = make(map[string]*DataSourcePlugin)
	StaticRoutes = make([]*PluginStaticRoute, 0)
	Panels = make(map[string]*PanelPlugin)
	Apps = make(map[string]*AppPlugin)
	PluginTypes = map[string]interface{}{
		"panel":      PanelPlugin{},
		"datasource": DataSourcePlugin{},
		"app":        AppPlugin{},
	}

	scan(path.Join(setting.StaticRootPath, "app/plugins"))
	scan(setting.PluginsPath)
	checkPluginPaths()
	// checkDependencies()
	return nil
}

// func checkDependencies() {
// 	for appType, app := range Apps {
// 		for _, reqPanel := range app.PanelPlugins {
// 			if _, ok := Panels[reqPanel]; !ok {
// 				log.Fatal(4, "App %s requires Panel type %s, but it is not present.", appType, reqPanel)
// 			}
// 		}
// 		for _, reqDataSource := range app.DatasourcePlugins {
// 			if _, ok := DataSources[reqDataSource]; !ok {
// 				log.Fatal(4, "App %s requires DataSource type %s, but it is not present.", appType, reqDataSource)
// 			}
// 		}
// 		for _, reqApiPlugin := range app.ApiPlugins {
// 			if _, ok := ApiPlugins[reqApiPlugin]; !ok {
// 				log.Fatal(4, "App %s requires ApiPlugin type %s, but it is not present.", appType, reqApiPlugin)
// 			}
// 		}
// 	}
// }

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

	if err := util.Walk(pluginDir, true, true, scanner.walker); err != nil {
		if pluginDir != "data/plugins" {
			log.Warn("Could not scan dir \"%v\" error: %s", pluginDir, err)
		}
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

func (scanner *PluginScanner) loadPluginJson(pluginJsonFilePath string) error {
	currentDir := filepath.Dir(pluginJsonFilePath)
	reader, err := os.Open(pluginJsonFilePath)
	if err != nil {
		return err
	}

	defer reader.Close()

	jsonParser := json.NewDecoder(reader)
	pluginCommon := PluginBase{}
	if err := jsonParser.Decode(&pluginCommon); err != nil {
		return err
	}

	if pluginCommon.Id == "" || pluginCommon.Type == "" {
		return errors.New("Did not find type and id property in plugin.json")
	}

	var loader PluginLoader
	if pluginGoType, exists := PluginTypes[pluginCommon.Type]; !exists {
		return errors.New("Unkown plugin type " + pluginCommon.Type)
	} else {
		loader = reflect.New(reflect.TypeOf(pluginGoType)).Interface().(PluginLoader)
	}

	reader.Seek(0, 0)
	return loader.Load(jsonParser, currentDir)
}
