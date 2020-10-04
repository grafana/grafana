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

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
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
	requireSigned        bool
	log                  log.Logger
}

type PluginManager struct {
	BackendPluginManager backendplugin.Manager `inject:""`
	Cfg                  *setting.Cfg          `inject:""`
	log                  log.Logger
	scanningErrors       []error
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
	pm.log.Debug("Scanning core plugin directory", "dir", plugDir)
	if err := pm.scan(plugDir, false); err != nil {
		return errutil.Wrapf(err, "failed to scan core plugin directory '%s'", plugDir)
	}

	plugDir = pm.Cfg.BundledPluginsPath
	pm.log.Debug("Scanning bundled plugins directory", "dir", plugDir)
	exists, err := fs.Exists(plugDir)
	if err != nil {
		return err
	}
	if exists {
		if err := pm.scan(plugDir, false); err != nil {
			return errutil.Wrapf(err, "failed to scan bundled plugins directory '%s'", plugDir)
		}
	}

	// check if plugins dir exists
	exists, err = fs.Exists(setting.PluginsPath)
	if err != nil {
		return err
	}
	if !exists {
		if err = os.MkdirAll(setting.PluginsPath, os.ModePerm); err != nil {
			pm.log.Error("failed to create external plugins directory", "dir", setting.PluginsPath, "error", err)
		} else {
			pm.log.Info("External plugins directory created", "directory", setting.PluginsPath)
		}
	} else {
		pm.log.Debug("Scanning external plugins directory", "dir", setting.PluginsPath)
		if err := pm.scan(setting.PluginsPath, true); err != nil {
			return errutil.Wrapf(err, "failed to scan external plugins directory '%s'",
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

	if Renderer != nil {
		Renderer.initFrontendPlugin()
	}

	for _, p := range Plugins {
		if p.IsCorePlugin {
			p.Signature = PluginSignatureInternal
		} else {
			p.Signature = getPluginSignatureState(pm.log, p)
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
	for pluginID, settings := range pm.Cfg.PluginSettings {
		path, exists := settings["path"]
		if !exists || path == "" {
			continue
		}

		if err := pm.scan(path, true); err != nil {
			return errutil.Wrapf(err, "failed to scan directory configured for plugin '%s': '%s'", pluginID, path)
		}
	}

	return nil
}

// scan a directory for plugins.
func (pm *PluginManager) scan(pluginDir string, requireSigned bool) error {
	scanner := &PluginScanner{
		pluginPath:           pluginDir,
		backendPluginManager: pm.BackendPluginManager,
		cfg:                  pm.Cfg,
		requireSigned:        requireSigned,
		log:                  pm.log,
	}

	if err := util.Walk(pluginDir, true, true, scanner.walker); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			pm.log.Debug("Couldn't scan directory since it doesn't exist", "pluginDir", pluginDir)
			return nil
		}
		if errors.Is(err, os.ErrPermission) {
			pm.log.Debug("Couldn't scan directory due to lack of permissions", "pluginDir", pluginDir)
			return nil
		}
		if pluginDir != "data/plugins" {
			pm.log.Warn("Could not scan dir", "pluginDir", pluginDir, "err", err)
		}
		return err
	}

	if len(scanner.errors) > 0 {
		pm.log.Warn("Some plugins failed to load", "errors", scanner.errors)
		pm.scanningErrors = scanner.errors
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

	if f.Name() == "plugin.json" {
		err := scanner.loadPlugin(currentPath)
		if err != nil {
			scanner.log.Error("Failed to load plugin", "error", err, "pluginPath", filepath.Dir(currentPath))
			scanner.errors = append(scanner.errors, err)
		}
	}
	return nil
}

func (scanner *PluginScanner) loadPlugin(pluginJsonFilePath string) error {
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
		return errors.New("did not find type or id properties in plugin.json")
	}

	// The expressions feature toggle corresponds to transform plug-ins.
	if pluginCommon.Type == "transform" {
		isEnabled := scanner.cfg.IsExpressionsEnabled()
		if !isEnabled {
			scanner.log.Debug("Transform plugin is disabled since the expressions feature toggle is not enabled",
				"pluginID", pluginCommon.Id)
			return nil
		}
	}

	pluginCommon.PluginDir = filepath.Dir(pluginJsonFilePath)

	// For the time being, we choose to only require back-end plugins to be signed
	// NOTE: the state is calculated again when setting metadata on the object
	if pluginCommon.Backend && scanner.requireSigned {
		sig := getPluginSignatureState(scanner.log, &pluginCommon)
		if sig != PluginSignatureValid {
			scanner.log.Debug("Invalid Plugin Signature", "pluginID", pluginCommon.Id, "pluginDir", pluginCommon.PluginDir, "state", sig)
			if sig == PluginSignatureUnsigned {
				allowUnsigned := false
				for _, plug := range scanner.cfg.PluginsAllowUnsigned {
					if plug == pluginCommon.Id {
						allowUnsigned = true
						break
					}
				}
				if setting.Env != setting.Dev && !allowUnsigned {
					return fmt.Errorf("plugin %q is unsigned", pluginCommon.Id)
				}
				scanner.log.Warn("Running an unsigned backend plugin", "pluginID", pluginCommon.Id, "pluginDir", pluginCommon.PluginDir)
			} else {
				switch sig {
				case PluginSignatureInvalid:
					return fmt.Errorf("plugin %q has an invalid signature", pluginCommon.Id)
				case PluginSignatureModified:
					return fmt.Errorf("plugin %q's signature has been modified", pluginCommon.Id)
				default:
					return fmt.Errorf("unrecognized plugin signature state %v", sig)
				}
			}
		}
	}

	pluginGoType, exists := PluginTypes[pluginCommon.Type]
	if !exists {
		return fmt.Errorf("unknown plugin type %q", pluginCommon.Type)
	}
	loader := reflect.New(reflect.TypeOf(pluginGoType)).Interface().(PluginLoader)

	// External plugins need a module.js file for SystemJS to load
	if !strings.HasPrefix(pluginJsonFilePath, setting.StaticRootPath) && !scanner.IsBackendOnlyPlugin(pluginCommon.Type) {
		module := filepath.Join(filepath.Dir(pluginJsonFilePath), "module.js")
		exists, err := fs.Exists(module)
		if err != nil {
			return err
		}
		if !exists {
			scanner.log.Warn("Plugin missing module.js",
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
	exists, err := fs.Exists(path)
	if err != nil {
		return nil, err
	}
	if !exists {
		path = filepath.Join(plug.PluginDir, fmt.Sprintf("%s.md", strings.ToLower(name)))
	}

	exists, err = fs.Exists(path)
	if err != nil {
		return nil, err
	}
	if !exists {
		return make([]byte, 0), nil
	}

	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return data, nil
}
