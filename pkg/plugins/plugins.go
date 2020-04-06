package plugins

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
	"reflect"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
	"golang.org/x/xerrors"
)

var (
	DataSources  map[string]*DataSourcePlugin
	Panels       map[string]*PanelPlugin
	StaticRoutes []*PluginStaticRoute
	Apps         map[string]*AppPlugin
	Plugins      map[string]*PluginBase
	PluginTypes  map[string]interface{}
	Renderer     *RendererPlugin
	Transform    *TransformPlugin

	GrafanaLatestVersion string
	GrafanaHasUpdate     bool
	plog                 log.Logger
)

type PluginScanner struct {
	pluginPath           string
	errors               []error
	backendPluginManager backendplugin.Manager
	cfg                  *setting.Cfg
}

type PluginManager struct {
	BackendPluginManager backendplugin.Manager `inject:""`
	Cfg                  *setting.Cfg          `inject:""`
	log                  log.Logger
}

func init() {
	registry.RegisterService(&PluginManager{})
}

func (pm *PluginManager) Init() error {
	pm.log = log.New("plugins")
	plog = log.New("plugins")

	DataSources = map[string]*DataSourcePlugin{}
	StaticRoutes = []*PluginStaticRoute{}
	Panels = map[string]*PanelPlugin{}
	Apps = map[string]*AppPlugin{}
	Plugins = map[string]*PluginBase{}
	PluginTypes = map[string]interface{}{
		"panel":      PanelPlugin{},
		"datasource": DataSourcePlugin{},
		"app":        AppPlugin{},
		"renderer":   RendererPlugin{},
		"transform":  TransformPlugin{},
	}

	pm.log.Info("Starting plugin search")
	plugDir := path.Join(setting.StaticRootPath, "app/plugins")
	if err := pm.scan(plugDir); err != nil {
		return errutil.Wrapf(err, "Failed to scan main plugin directory '%s'", plugDir)
	}

	// check if plugins dir exists
	if _, err := os.Stat(setting.PluginsPath); os.IsNotExist(err) {
		if err = os.MkdirAll(setting.PluginsPath, os.ModePerm); err != nil {
			plog.Error("Failed to create plugin dir", "dir", setting.PluginsPath, "error", err)
		} else {
			plog.Info("Plugin dir created", "dir", setting.PluginsPath)
			if err := pm.scan(setting.PluginsPath); err != nil {
				return errutil.Wrapf(err, "Failed to scan configured plugin directory '%s'",
					setting.PluginsPath)
			}
		}
	} else {
		if err := pm.scan(setting.PluginsPath); err != nil {
			return errutil.Wrapf(err, "Failed to scan configured plugin directory '%s'",
				setting.PluginsPath)
		}
	}

	// check plugin paths defined in config
	if err := pm.checkPluginPaths(); err != nil {
		return err
	}

	for _, panel := range Panels {
		panel.initFrontendPlugin()
	}

	for _, ds := range DataSources {
		ds.initFrontendPlugin()
	}

	for _, app := range Apps {
		app.initApp()
	}

	for _, p := range Plugins {
		if !p.IsCorePlugin {
			metrics.SetPluginBuildInformation(p.Id, p.Type, p.Info.Version)
		}
	}

	return nil
}

func (pm *PluginManager) Run(ctx context.Context) error {
	pm.updateAppDashboards()
	pm.checkForUpdates()

	ticker := time.NewTicker(time.Minute * 10)
	run := true

	for run {
		select {
		case <-ticker.C:
			pm.checkForUpdates()
		case <-ctx.Done():
			run = false
		}
	}

	return ctx.Err()
}

func (pm *PluginManager) checkPluginPaths() error {
	for _, section := range setting.Raw.Sections() {
		if !strings.HasPrefix(section.Name(), "plugin.") {
			continue
		}

		path := section.Key("path").String()
		if path == "" {
			continue
		}

		if err := pm.scan(path); err != nil {
			return errutil.Wrapf(err, "Failed to scan directory configured for plugin '%s': '%s'",
				section.Name(), path)
		}
	}

	return nil
}

// scan a directory for plugins.
func (pm *PluginManager) scan(pluginDir string) error {
	scanner := &PluginScanner{
		pluginPath:           pluginDir,
		backendPluginManager: pm.BackendPluginManager,
		cfg:                  pm.Cfg,
	}

	if err := util.Walk(pluginDir, true, true, scanner.walker); err != nil {
		if xerrors.Is(err, os.ErrNotExist) {
			pm.log.Debug("Couldn't scan dir '%s' since it doesn't exist")
			return nil
		}
		if xerrors.Is(err, os.ErrPermission) {
			pm.log.Debug("Couldn't scan dir '%s' due to lack of permissions")
			return nil
		}
		if pluginDir != "data/plugins" {
			pm.log.Warn("Could not scan dir", "pluginDir", pluginDir, "err", err)
		}
		return err
	}

	if len(scanner.errors) > 0 {
		pm.log.Warn("Some plugins failed to load", "errors", scanner.errors)
	}

	return nil
}

// GetDatasource returns a datasource based on passed pluginID if it exists
//
// This function fetches the datasource from the global variable DataSources in this package.
// Rather then refactor all dependencies on the global variable we can use this as an transition.
func (pm *PluginManager) GetDatasource(pluginID string) (*DataSourcePlugin, bool) {
	ds, exist := DataSources[pluginID]
	return ds, exist
}

func (scanner *PluginScanner) walker(currentPath string, f os.FileInfo, err error) error {
	// We scan all the subfolders for plugin.json (with some exceptions) so that we also load embedded plugins, for
	// example https://github.com/raintank/worldping-app/tree/master/dist/grafana-worldmap-panel worldmap panel plugin
	// is embedded in worldping app.
	if err != nil {
		return err
	}

	if f.Name() == "node_modules" || f.Name() == "Chromium.app" {
		return util.ErrWalkSkipDir
	}

	if f.IsDir() {
		return nil
	}

	if !scanner.cfg.FeatureToggles["tracingIntegration"] {
		// Do not load tracing datasources if
		prefix := path.Join(setting.StaticRootPath, "app/plugins/datasource")
		if strings.Contains(currentPath, path.Join(prefix, "jaeger")) || strings.Contains(currentPath, path.Join(prefix, "zipkin")) {
			return nil
		}
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
	pluginGoType, exists := PluginTypes[pluginCommon.Type]
	if !exists {
		return errors.New("Unknown plugin type " + pluginCommon.Type)
	}
	loader = reflect.New(reflect.TypeOf(pluginGoType)).Interface().(PluginLoader)

	// External plugins need a module.js file for SystemJS to load
	if !strings.HasPrefix(pluginJsonFilePath, setting.StaticRootPath) && !scanner.IsBackendOnlyPlugin(pluginCommon.Type) {
		module := filepath.Join(filepath.Dir(pluginJsonFilePath), "module.js")
		if _, err := os.Stat(module); os.IsNotExist(err) {
			plog.Warn("Plugin missing module.js",
				"name", pluginCommon.Name,
				"warning", "Missing module.js, If you loaded this plugin from git, make sure to compile it.",
				"path", module)
		}
	}

	if _, err := reader.Seek(0, 0); err != nil {
		return err
	}
	return loader.Load(jsonParser, currentDir, scanner.backendPluginManager)
}

func (scanner *PluginScanner) IsBackendOnlyPlugin(pluginType string) bool {
	return pluginType == "renderer" || pluginType == "transform"
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

	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return data, nil
}
