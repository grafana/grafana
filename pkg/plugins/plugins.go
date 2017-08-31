package plugins

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
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
	Plugins      map[string]*PluginBase
	PluginTypes  map[string]interface{}

	GrafanaLatestVersion string
	GrafanaHasUpdate     bool
	plog                 log.Logger
)

type PluginScanner struct {
	pluginPath string
	errors     []error
}

func Init() error {
	plog = log.New("plugins")

	DataSources = make(map[string]*DataSourcePlugin)
	StaticRoutes = make([]*PluginStaticRoute, 0)
	Panels = make(map[string]*PanelPlugin)
	Apps = make(map[string]*AppPlugin)
	Plugins = make(map[string]*PluginBase)
	PluginTypes = map[string]interface{}{
		"panel":      PanelPlugin{},
		"datasource": DataSourcePlugin{},
		"app":        AppPlugin{},
	}

	plog.Info("Starting plugin search")
	scan(path.Join(setting.StaticRootPath, "app/plugins"))

	// check if plugins dir exists
	if _, err := os.Stat(setting.PluginsPath); os.IsNotExist(err) {
		plog.Warn("Plugin dir does not exist", "dir", setting.PluginsPath)
		if err = os.MkdirAll(setting.PluginsPath, os.ModePerm); err != nil {
			plog.Warn("Failed to create plugin dir", "dir", setting.PluginsPath, "error", err)
		} else {
			plog.Info("Plugin dir created", "dir", setting.PluginsPath)
			scan(setting.PluginsPath)
		}
	} else {
		scan(setting.PluginsPath)
	}

	// check plugin paths defined in config
	checkPluginPaths()

	for _, panel := range Panels {
		panel.initFrontendPlugin()
	}
	for _, panel := range DataSources {
		panel.initFrontendPlugin()
	}
	for _, app := range Apps {
		app.initApp()
	}

	go StartPluginUpdateChecker()
	go updateAppDashboards()

	return nil
}

func checkPluginPaths() error {
	for _, section := range setting.Cfg.Sections() {
		if strings.HasPrefix(section.Name(), "plugin.") {
			path := section.Key("path").String()
			if path != "" {
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

	if f.Name() == "node_modules" {
		return util.WalkSkipDir
	}

	if f.IsDir() {
		return nil
	}

	if f.Name() == "plugin.json" {
		err := scanner.loadPluginJson(currentPath)
		if err != nil {
			log.Error(3, "Plugins: Failed to load plugin json file: %v,  err: %v", currentPath, err)
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
		return errors.New("Unknown plugin type " + pluginCommon.Type)
	} else {
		loader = reflect.New(reflect.TypeOf(pluginGoType)).Interface().(PluginLoader)
	}

	reader.Seek(0, 0)
	return loader.Load(jsonParser, currentDir)
}

func GetPluginMarkdown(pluginId string, name string) ([]byte, error) {
	plug, exists := Plugins[pluginId]
	if !exists {
		return nil, PluginNotFoundError{pluginId}
	}

	path := filepath.Join(plug.PluginDir, fmt.Sprintf("%s.md", strings.ToUpper(name)))
	if _, err := os.Stat(path); os.IsNotExist(err) {
		path = filepath.Join(plug.PluginDir, fmt.Sprintf("%s.md", strings.ToLower(name)))
	}

	if _, err := os.Stat(path); os.IsNotExist(err) {
		return make([]byte, 0), nil
	}

	if data, err := ioutil.ReadFile(path); err != nil {
		return nil, err
	} else {
		return data, nil
	}
}
