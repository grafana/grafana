// Package manager contains plugin manager logic.
package manager

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	plog log.Logger
)

type unsignedPluginConditionFunc = func(plugin *plugins.PluginBase) bool

type PluginScanner struct {
	pluginPath                    string
	errors                        []error
	backendPluginManager          backendplugin.Manager
	cfg                           *setting.Cfg
	requireSigned                 bool
	log                           log.Logger
	plugins                       map[string]*plugins.PluginBase
	allowUnsignedPluginsCondition unsignedPluginConditionFunc
}

type PluginManager struct {
	BackendPluginManager backendplugin.Manager `inject:""`
	Cfg                  *setting.Cfg          `inject:""`
	SQLStore             *sqlstore.SQLStore    `inject:""`
	log                  log.Logger
	scanningErrors       []error

	// AllowUnsignedPluginsCondition changes the policy for allowing unsigned plugins. Signature validation only runs when plugins are starting
	// and running plugins will not be terminated if they violate the new policy.
	AllowUnsignedPluginsCondition unsignedPluginConditionFunc
	grafanaLatestVersion          string
	grafanaHasUpdate              bool
	pluginScanningErrors          map[string]plugins.PluginError

	renderer     *plugins.RendererPlugin
	dataSources  map[string]*plugins.DataSourcePlugin
	plugins      map[string]*plugins.PluginBase
	panels       map[string]*plugins.PanelPlugin
	apps         map[string]*plugins.AppPlugin
	staticRoutes []*plugins.PluginStaticRoute
}

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "PluginManager",
		Instance:     newManager(nil),
		InitPriority: registry.MediumHigh,
	})
}

func newManager(cfg *setting.Cfg) *PluginManager {
	return &PluginManager{
		Cfg:         cfg,
		dataSources: map[string]*plugins.DataSourcePlugin{},
		plugins:     map[string]*plugins.PluginBase{},
		panels:      map[string]*plugins.PanelPlugin{},
		apps:        map[string]*plugins.AppPlugin{},
	}
}

func (pm *PluginManager) Init() error {
	pm.log = log.New("plugins")
	plog = log.New("plugins")
	pm.pluginScanningErrors = map[string]plugins.PluginError{}

	pm.log.Info("Starting plugin search")

	plugDir := filepath.Join(pm.Cfg.StaticRootPath, "app/plugins")
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
	exists, err = fs.Exists(pm.Cfg.PluginsPath)
	if err != nil {
		return err
	}
	if !exists {
		if err = os.MkdirAll(pm.Cfg.PluginsPath, os.ModePerm); err != nil {
			pm.log.Error("failed to create external plugins directory", "dir", pm.Cfg.PluginsPath, "error", err)
		} else {
			pm.log.Info("External plugins directory created", "directory", pm.Cfg.PluginsPath)
		}
	} else {
		pm.log.Debug("Scanning external plugins directory", "dir", pm.Cfg.PluginsPath)
		if err := pm.scan(pm.Cfg.PluginsPath, true); err != nil {
			return errutil.Wrapf(err, "failed to scan external plugins directory '%s'",
				pm.Cfg.PluginsPath)
		}
	}

	if err := pm.scanPluginPaths(); err != nil {
		return err
	}

	for _, panel := range pm.panels {
		staticRoutes := panel.InitFrontendPlugin(pm.Cfg)
		pm.staticRoutes = append(pm.staticRoutes, staticRoutes...)
	}

	for _, ds := range pm.dataSources {
		staticRoutes := ds.InitFrontendPlugin(pm.Cfg)
		pm.staticRoutes = append(pm.staticRoutes, staticRoutes...)
	}

	for _, app := range pm.apps {
		staticRoutes := app.InitApp(pm.panels, pm.dataSources, pm.Cfg)
		pm.staticRoutes = append(pm.staticRoutes, staticRoutes...)
	}

	if pm.renderer != nil {
		staticRoutes := pm.renderer.InitFrontendPlugin(pm.Cfg)
		pm.staticRoutes = append(pm.staticRoutes, staticRoutes...)
	}

	for _, p := range pm.plugins {
		if p.IsCorePlugin {
			p.Signature = plugins.PluginSignatureInternal
		} else {
			metrics.SetPluginBuildInformation(p.Id, p.Type, p.Info.Version)
		}
	}

	return nil
}

func (pm *PluginManager) Run(ctx context.Context) error {
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

func (pm *PluginManager) Renderer() *plugins.RendererPlugin {
	return pm.renderer
}

func (pm *PluginManager) GetDataSource(id string) *plugins.DataSourcePlugin {
	return pm.dataSources[id]
}

func (pm *PluginManager) DataSources() []*plugins.DataSourcePlugin {
	var rslt []*plugins.DataSourcePlugin
	for _, ds := range pm.dataSources {
		rslt = append(rslt, ds)
	}

	return rslt
}

func (pm *PluginManager) DataSourceCount() int {
	return len(pm.dataSources)
}

func (pm *PluginManager) PanelCount() int {
	return len(pm.panels)
}

func (pm *PluginManager) AppCount() int {
	return len(pm.apps)
}

func (pm *PluginManager) Plugins() []*plugins.PluginBase {
	var rslt []*plugins.PluginBase
	for _, p := range pm.plugins {
		rslt = append(rslt, p)
	}

	return rslt
}

func (pm *PluginManager) Apps() []*plugins.AppPlugin {
	var rslt []*plugins.AppPlugin
	for _, p := range pm.apps {
		rslt = append(rslt, p)
	}

	return rslt
}

func (pm *PluginManager) GetPlugin(id string) *plugins.PluginBase {
	return pm.plugins[id]
}

func (pm *PluginManager) GetApp(id string) *plugins.AppPlugin {
	return pm.apps[id]
}

func (pm *PluginManager) GrafanaLatestVersion() string {
	return pm.grafanaLatestVersion
}

func (pm *PluginManager) GrafanaHasUpdate() bool {
	return pm.grafanaHasUpdate
}

// scanPluginPaths scans configured plugin paths.
func (pm *PluginManager) scanPluginPaths() error {
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
		pluginPath:                    pluginDir,
		backendPluginManager:          pm.BackendPluginManager,
		cfg:                           pm.Cfg,
		requireSigned:                 requireSigned,
		log:                           pm.log,
		plugins:                       map[string]*plugins.PluginBase{},
		allowUnsignedPluginsCondition: pm.AllowUnsignedPluginsCondition,
	}

	// 1st pass: Scan plugins, also mapping plugins to their respective directories
	if err := util.Walk(pluginDir, true, true, scanner.walker); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			pm.log.Debug("Couldn't scan directory since it doesn't exist", "pluginDir", pluginDir, "err", err)
			return nil
		}
		if errors.Is(err, os.ErrPermission) {
			pm.log.Debug("Couldn't scan directory due to lack of permissions", "pluginDir", pluginDir, "err", err)
			return nil
		}
		if pluginDir != "data/plugins" {
			pm.log.Warn("Could not scan dir", "pluginDir", pluginDir, "err", err)
		}
		return err
	}

	pm.log.Debug("Initial plugin loading done")

	pluginTypes := map[string]interface{}{
		"panel":      plugins.PanelPlugin{},
		"datasource": plugins.DataSourcePlugin{},
		"app":        plugins.AppPlugin{},
		"renderer":   plugins.RendererPlugin{},
	}

	// 2nd pass: Validate and register plugins
	for dpath, plugin := range scanner.plugins {
		// Try to find any root plugin
		ancestors := strings.Split(dpath, string(filepath.Separator))
		ancestors = ancestors[0 : len(ancestors)-1]
		aPath := ""
		if runtime.GOOS != "windows" && filepath.IsAbs(dpath) {
			aPath = "/"
		}
		for _, a := range ancestors {
			aPath = filepath.Join(aPath, a)
			if root, ok := scanner.plugins[aPath]; ok {
				plugin.Root = root
				break
			}
		}

		pm.log.Debug("Found plugin", "id", plugin.Id, "signature", plugin.Signature, "hasRoot", plugin.Root != nil)
		signingError := scanner.validateSignature(plugin)
		if signingError != nil {
			pm.log.Debug("Failed to validate plugin signature. Will skip loading", "id", plugin.Id,
				"signature", plugin.Signature, "status", signingError.ErrorCode)
			pm.pluginScanningErrors[plugin.Id] = *signingError
			continue
		}

		pm.log.Debug("Attempting to add plugin", "id", plugin.Id)

		pluginGoType, exists := pluginTypes[plugin.Type]
		if !exists {
			return fmt.Errorf("unknown plugin type %q", plugin.Type)
		}

		jsonFPath := filepath.Join(plugin.PluginDir, "plugin.json")

		// External plugins need a module.js file for SystemJS to load
		if !strings.HasPrefix(jsonFPath, pm.Cfg.StaticRootPath) && !scanner.IsBackendOnlyPlugin(plugin.Type) {
			module := filepath.Join(plugin.PluginDir, "module.js")
			exists, err := fs.Exists(module)
			if err != nil {
				return err
			}
			if !exists {
				scanner.log.Warn("Plugin missing module.js",
					"name", plugin.Name,
					"warning", "Missing module.js, If you loaded this plugin from git, make sure to compile it.",
					"path", module)
			}
		}

		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `jsonFPath` is based
		// on plugin the folder structure on disk and not user input.
		reader, err := os.Open(jsonFPath)
		if err != nil {
			return err
		}
		defer func() {
			if err := reader.Close(); err != nil {
				scanner.log.Warn("Failed to close JSON file", "path", jsonFPath, "err", err)
			}
		}()

		jsonParser := json.NewDecoder(reader)

		loader := reflect.New(reflect.TypeOf(pluginGoType)).Interface().(plugins.PluginLoader)

		// Load the full plugin, and add it to manager
		if err := pm.loadPlugin(jsonParser, plugin, scanner, loader); err != nil {
			return err
		}
	}

	if len(scanner.errors) > 0 {
		pm.log.Warn("Some plugins failed to load", "errors", scanner.errors)
		pm.scanningErrors = scanner.errors
	}

	return nil
}

func (pm *PluginManager) loadPlugin(jsonParser *json.Decoder, pluginBase *plugins.PluginBase,
	scanner *PluginScanner, loader plugins.PluginLoader) error {
	plug, err := loader.Load(jsonParser, pluginBase, scanner.backendPluginManager)
	if err != nil {
		return err
	}

	var pb *plugins.PluginBase
	switch p := plug.(type) {
	case *plugins.DataSourcePlugin:
		pm.dataSources[p.Id] = p
		pb = &p.PluginBase
	case *plugins.PanelPlugin:
		pm.panels[p.Id] = p
		pb = &p.PluginBase
	case *plugins.RendererPlugin:
		pm.renderer = p
		pb = &p.PluginBase
	case *plugins.AppPlugin:
		pm.apps[p.Id] = p
		pb = &p.PluginBase
	default:
		panic(fmt.Sprintf("Unrecognized plugin type %T", plug))
	}

	if p, exists := pm.plugins[pb.Id]; exists {
		pm.log.Warn("Plugin is duplicate", "id", pb.Id)
		scanner.errors = append(scanner.errors, plugins.DuplicatePluginError{Plugin: pb, ExistingPlugin: p})
		return nil
	}

	if !strings.HasPrefix(pluginBase.PluginDir, pm.Cfg.StaticRootPath) {
		pm.log.Info("Registering plugin", "id", pb.Id)
	}

	if len(pb.Dependencies.Plugins) == 0 {
		pb.Dependencies.Plugins = []plugins.PluginDependencyItem{}
	}

	if pb.Dependencies.GrafanaVersion == "" {
		pb.Dependencies.GrafanaVersion = "*"
	}

	for _, include := range pb.Includes {
		if include.Role == "" {
			include.Role = models.ROLE_VIEWER
		}
	}

	// Copy relevant fields from the base
	pb.PluginDir = pluginBase.PluginDir
	pb.Signature = pluginBase.Signature
	pb.SignatureType = pluginBase.SignatureType
	pb.SignatureOrg = pluginBase.SignatureOrg

	pm.plugins[pb.Id] = pb
	pm.log.Debug("Successfully added plugin", "id", pb.Id)
	return nil
}

func (s *PluginScanner) walker(currentPath string, f os.FileInfo, err error) error {
	// We scan all the subfolders for plugin.json (with some exceptions) so that we also load embedded plugins, for
	// example https://github.com/raintank/worldping-app/tree/master/dist/grafana-worldmap-panel worldmap panel plugin
	// is embedded in worldping app.
	if err != nil {
		return fmt.Errorf("filepath.Walk reported an error for %q: %w", currentPath, err)
	}

	if f.Name() == "node_modules" || f.Name() == "Chromium.app" {
		return util.ErrWalkSkipDir
	}

	if f.IsDir() {
		return nil
	}

	if f.Name() != "plugin.json" {
		return nil
	}

	if err := s.loadPlugin(currentPath); err != nil {
		s.log.Error("Failed to load plugin", "error", err, "pluginPath", filepath.Dir(currentPath))
		s.errors = append(s.errors, err)
	}

	return nil
}

func (s *PluginScanner) loadPlugin(pluginJSONFilePath string) error {
	s.log.Debug("Loading plugin", "path", pluginJSONFilePath)
	currentDir := filepath.Dir(pluginJSONFilePath)
	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `currentPath` is based
	// on plugin the folder structure on disk and not user input.
	reader, err := os.Open(pluginJSONFilePath)
	if err != nil {
		return err
	}
	defer func() {
		if err := reader.Close(); err != nil {
			s.log.Warn("Failed to close JSON file", "path", pluginJSONFilePath, "err", err)
		}
	}()

	jsonParser := json.NewDecoder(reader)
	pluginCommon := plugins.PluginBase{}
	if err := jsonParser.Decode(&pluginCommon); err != nil {
		return err
	}

	if pluginCommon.Id == "" || pluginCommon.Type == "" {
		return errors.New("did not find type or id properties in plugin.json")
	}

	pluginCommon.PluginDir = filepath.Dir(pluginJSONFilePath)
	pluginCommon.Files, err = collectPluginFilesWithin(pluginCommon.PluginDir)
	if err != nil {
		s.log.Warn("Could not collect plugin file information in directory", "pluginID", pluginCommon.Id, "dir", pluginCommon.PluginDir)
		return err
	}

	signatureState, err := getPluginSignatureState(s.log, &pluginCommon)
	if err != nil {
		s.log.Warn("Could not get plugin signature state", "pluginID", pluginCommon.Id, "err", err)
		return err
	}
	pluginCommon.Signature = signatureState.Status
	pluginCommon.SignatureType = signatureState.Type
	pluginCommon.SignatureOrg = signatureState.SigningOrg

	s.plugins[currentDir] = &pluginCommon

	return nil
}

func (*PluginScanner) IsBackendOnlyPlugin(pluginType string) bool {
	return pluginType == "renderer"
}

// validateSignature validates a plugin's signature.
func (s *PluginScanner) validateSignature(plugin *plugins.PluginBase) *plugins.PluginError {
	if plugin.Signature == plugins.PluginSignatureValid {
		s.log.Debug("Plugin has valid signature", "id", plugin.Id)
		return nil
	}

	if plugin.Root != nil {
		// If a descendant plugin with invalid signature, set signature to that of root
		if plugin.IsCorePlugin || plugin.Signature == plugins.PluginSignatureInternal {
			s.log.Debug("Not setting descendant plugin's signature to that of root since it's core or internal",
				"plugin", plugin.Id, "signature", plugin.Signature, "isCore", plugin.IsCorePlugin)
		} else {
			s.log.Debug("Setting descendant plugin's signature to that of root", "plugin", plugin.Id,
				"root", plugin.Root.Id, "signature", plugin.Signature, "rootSignature", plugin.Root.Signature)
			plugin.Signature = plugin.Root.Signature
			if plugin.Signature == plugins.PluginSignatureValid {
				s.log.Debug("Plugin has valid signature (inherited from root)", "id", plugin.Id)
				return nil
			}
		}
	} else {
		s.log.Debug("Non-valid plugin Signature", "pluginID", plugin.Id, "pluginDir", plugin.PluginDir,
			"state", plugin.Signature)
	}

	// For the time being, we choose to only require back-end plugins to be signed
	// NOTE: the state is calculated again when setting metadata on the object
	if !plugin.Backend || !s.requireSigned {
		return nil
	}

	switch plugin.Signature {
	case plugins.PluginSignatureUnsigned:
		if allowed := s.allowUnsigned(plugin); !allowed {
			s.log.Debug("Plugin is unsigned", "id", plugin.Id)
			s.errors = append(s.errors, fmt.Errorf("plugin %q is unsigned", plugin.Id))
			return &plugins.PluginError{
				ErrorCode: signatureMissing,
			}
		}
		s.log.Warn("Running an unsigned backend plugin", "pluginID", plugin.Id, "pluginDir",
			plugin.PluginDir)
		return nil
	case plugins.PluginSignatureInvalid:
		s.log.Debug("Plugin %q has an invalid signature", plugin.Id)
		s.errors = append(s.errors, fmt.Errorf("plugin %q has an invalid signature", plugin.Id))
		return &plugins.PluginError{
			ErrorCode: signatureInvalid,
		}
	case plugins.PluginSignatureModified:
		s.log.Debug("Plugin %q has a modified signature", plugin.Id)
		s.errors = append(s.errors, fmt.Errorf("plugin %q's signature has been modified", plugin.Id))
		return &plugins.PluginError{
			ErrorCode: signatureModified,
		}
	default:
		panic(fmt.Sprintf("Plugin %q has unrecognized plugin signature state %q", plugin.Id, plugin.Signature))
	}
}

func (s *PluginScanner) allowUnsigned(plugin *plugins.PluginBase) bool {
	if s.allowUnsignedPluginsCondition != nil {
		return s.allowUnsignedPluginsCondition(plugin)
	}

	if s.cfg.Env == setting.Dev {
		return true
	}

	for _, plug := range s.cfg.PluginsAllowUnsigned {
		if plug == plugin.Id {
			return true
		}
	}

	return false
}

// ScanningErrors returns plugin scanning errors encountered.
func (pm *PluginManager) ScanningErrors() []plugins.PluginError {
	scanningErrs := make([]plugins.PluginError, 0)
	for id, e := range pm.pluginScanningErrors {
		scanningErrs = append(scanningErrs, plugins.PluginError{
			ErrorCode: e.ErrorCode,
			PluginID:  id,
		})
	}
	return scanningErrs
}

func (pm *PluginManager) GetPluginMarkdown(pluginId string, name string) ([]byte, error) {
	plug, exists := pm.plugins[pluginId]
	if !exists {
		return nil, plugins.PluginNotFoundError{PluginID: pluginId}
	}

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `plug.PluginDir` is based
	// on plugin the folder structure on disk and not user input.
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

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `plug.PluginDir` is based
	// on plugin the folder structure on disk and not user input.
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return data, nil
}

// gets plugin filenames that require verification for plugin signing
func collectPluginFilesWithin(rootDir string) ([]string, error) {
	var files []string
	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && info.Name() != "MANIFEST.txt" {
			file, err := filepath.Rel(rootDir, path)
			if err != nil {
				return err
			}
			files = append(files, filepath.ToSlash(file))
		}
		return nil
	})
	return files, err
}

// GetDataPlugin gets a DataPlugin with a certain name. If none is found, nil is returned.
//nolint: staticcheck // plugins.DataPlugin deprecated
func (pm *PluginManager) GetDataPlugin(id string) plugins.DataPlugin {
	if p, exists := pm.dataSources[id]; exists && p.CanHandleDataQueries() {
		return p
	}

	// XXX: Might other plugins implement DataPlugin?

	p := pm.BackendPluginManager.GetDataPlugin(id)
	if p != nil {
		return p.(plugins.DataPlugin)
	}

	return nil
}

func (pm *PluginManager) StaticRoutes() []*plugins.PluginStaticRoute {
	return pm.staticRoutes
}
