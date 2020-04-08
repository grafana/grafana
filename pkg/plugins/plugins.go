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

	pm.log.Info("Checking Bundled Plugins")
	plugDir = path.Join(setting.HomePath, "plugins-bundled")
	if _, err := os.Stat(plugDir); !os.IsNotExist(err) {
		if err := pm.scan(plugDir); err != nil {
			return errutil.Wrapf(err, "failed to scan bundled plugin directory '%s'", plugDir)
		}
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
		if p.IsCorePlugin {
			p.Signature = PluginSignatureInternal
		} else {
			p.Signature = getPluginSignatureState(p.PluginDir)
			metrics.SetPluginBuildInformation(p.Id, p.Type, p.Info.Version)
		}
	}

	return nil
}

func getPluginSignatureState(dir string) PluginSignature {
	manifestPath := path.Join(dir, "MANIFEST.txt")
	info, _ := os.Stat(manifestPath)
	if info == nil || info.Size() < 5 {
		return PluginSignatureUnsigned
	}

	// 1. TODO: validate PGP signature
	// if( !valid ) {
	//   return PluginSignatureInvalid
	// }

	// 2. check the manifest contents... currently looks like:
	//
	// 7df059597099bb7dcf25d2a9aedfaf4465f72d8d  LICENSE
	// 4ebed28a02dc029719296aa847bffcea8eb5b9ff  README.md
	// e9cb53cd0493676600dd5135b5fdbe327694855b  docs/img/copy-range.png
	// 63d79d0e0f9db21ea168324bd4e180d6892b9d2b  docs/img/dashboard.png
	// 262f2bfddb004c7ce567042e8096f9e033c9b1bd  docs/img/query-editor.png
	// 6d1837e04d57c69477d92de32e445b3c8fdb4a11  docs/img/spreadsheet.png
	// fc42c37063781010fa61fe7b00bfaae5f40347e2  docs/img/spreadsheets-list.png
	// 4493f107eb175b085f020c1afea04614232dc0fd  gfx_sheets_darwin_amd64
	// d8b05884e3829d1389a9c0e4b79b0aba8c19ca4a  gfx_sheets_linux_amd64
	// 88f33db20182e17c72c2823fe3bed87d8c45b0fd  gfx_sheets_windows_amd64.exe
	// e6d8f6704dbe85d5f032d4e8ba44ebc5d4a68c43  img/config-page.png
	// 63d79d0e0f9db21ea168324bd4e180d6892b9d2b  img/dashboard.png
	// 7ea6295954b24be55b27320af2074852fb088fa1  img/graph.png
	// 262f2bfddb004c7ce567042e8096f9e033c9b1bd  img/query-editor.png
	// f134ab85caff88b59ea903c5491c6a08c221622f  img/sheets.svg
	// 6d1837e04d57c69477d92de32e445b3c8fdb4a11  img/spreadsheet.png
	// 8edb4a5967f128cb1b4bb060870895e15392fe57  img/table.png
	// 40b8c38cea260caed3cdc01d6e3c1eca483ab5c1  module.js
	// 3c04068eb581f73a262a2081f4adca2edbb14edf  module.js.map
	// bfcae42976f0feca58eed3636655bce51702d3ed  plugin.json

	// For now everything is invalid or missing
	return PluginSignatureInvalid
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
