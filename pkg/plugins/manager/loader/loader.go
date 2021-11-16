package loader

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/initializer"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger                       = log.New("plugin.loader")
	ErrInvalidPluginJSON         = errors.New("did not find valid type or id properties in plugin.json")
	ErrInvalidPluginJSONFilePath = errors.New("invalid plugin.json filepath was provided")
)

var _ plugins.ErrorResolver = (*Loader)(nil)

type Loader struct {
	cfg                *setting.Cfg
	pluginFinder       finder.Finder
	pluginInitializer  initializer.Initializer
	signatureValidator signature.Validator

	errs map[string]*plugins.SignatureError
}

func ProvideService(license models.Licensing, cfg *setting.Cfg, authorizer plugins.PluginLoaderAuthorizer) (*Loader, error) {
	return New(license, cfg, authorizer), nil
}

func New(license models.Licensing, cfg *setting.Cfg, authorizer plugins.PluginLoaderAuthorizer) *Loader {
	return &Loader{
		cfg:                cfg,
		pluginFinder:       finder.New(cfg),
		pluginInitializer:  initializer.New(cfg, license),
		signatureValidator: signature.NewValidator(authorizer),
		errs:               make(map[string]*plugins.SignatureError),
	}
}

func (l *Loader) Load(paths []string, ignore map[string]struct{}) ([]*plugins.Plugin, error) {
	pluginJSONPaths, err := l.pluginFinder.Find(paths)
	if err != nil {
		logger.Error("plugin finder encountered an error", "err", err)
	}

	return l.loadPlugins(pluginJSONPaths, ignore)
}

func (l *Loader) LoadWithFactory(path string, factory backendplugin.PluginFactoryFunc) (*plugins.Plugin, error) {
	p, err := l.load(path, map[string]struct{}{})
	if err != nil {
		logger.Error("failed to load core plugin", "err", err)
		return nil, err
	}

	err = l.pluginInitializer.InitializeWithFactory(p, factory)

	return p, err
}

func (l *Loader) load(path string, ignore map[string]struct{}) (*plugins.Plugin, error) {
	pluginJSONPaths, err := l.pluginFinder.Find([]string{path})
	if err != nil {
		logger.Error("failed to find plugin", "err", err)
		return nil, err
	}

	loadedPlugins, err := l.loadPlugins(pluginJSONPaths, ignore)
	if err != nil {
		return nil, err
	}

	if len(loadedPlugins) == 0 {
		return nil, fmt.Errorf("could not load plugin at path %s", path)
	}

	return loadedPlugins[0], nil
}

func (l *Loader) loadPlugins(pluginJSONPaths []string, existingPlugins map[string]struct{}) ([]*plugins.Plugin, error) {
	var foundPlugins = foundPlugins{}

	// load plugin.json files and map directory to JSON data
	for _, pluginJSONPath := range pluginJSONPaths {
		plugin, err := l.readPluginJSON(pluginJSONPath)
		if err != nil {
			logger.Warn("Skipping plugin loading as it's plugin.json is invalid", "id", plugin.ID)
			continue
		}

		pluginJSONAbsPath, err := filepath.Abs(pluginJSONPath)
		if err != nil {
			logger.Warn("Skipping plugin loading as full plugin.json path could not be calculated", "id", plugin.ID)
			continue
		}

		if _, dupe := foundPlugins[filepath.Dir(pluginJSONAbsPath)]; dupe {
			logger.Warn("Skipping plugin loading as it's a duplicate", "id", plugin.ID)
			continue
		}
		foundPlugins[filepath.Dir(pluginJSONAbsPath)] = plugin
	}

	foundPlugins.stripDuplicates(existingPlugins)

	// calculate initial signature state
	loadedPlugins := make(map[string]*plugins.Plugin)
	for pluginDir, pluginJSON := range foundPlugins {
		plugin := &plugins.Plugin{
			JSONData:  pluginJSON,
			PluginDir: pluginDir,
			Class:     l.pluginClass(pluginDir),
		}

		sig, err := signature.Calculate(logger, plugin)
		if err != nil {
			logger.Warn("Could not calculate plugin signature state", "pluginID", plugin.ID, "err", err)
			continue
		}
		plugin.Signature = sig.Status
		plugin.SignatureType = sig.Type
		plugin.SignatureOrg = sig.SigningOrg
		plugin.SignedFiles = sig.Files

		loadedPlugins[plugin.PluginDir] = plugin
	}

	// wire up plugin dependencies
	for _, plugin := range loadedPlugins {
		ancestors := strings.Split(plugin.PluginDir, string(filepath.Separator))
		ancestors = ancestors[0 : len(ancestors)-1]
		pluginPath := ""

		if runtime.GOOS != "windows" && filepath.IsAbs(plugin.PluginDir) {
			pluginPath = "/"
		}
		for _, ancestor := range ancestors {
			pluginPath = filepath.Join(pluginPath, ancestor)
			if parentPlugin, ok := loadedPlugins[pluginPath]; ok {
				plugin.Parent = parentPlugin
				plugin.Parent.Children = append(plugin.Parent.Children, plugin)
				break
			}
		}
	}

	// validate signatures
	verifiedPlugins := []*plugins.Plugin{}
	for _, plugin := range loadedPlugins {
		signingError := l.signatureValidator.Validate(plugin)
		if signingError != nil {
			logger.Warn("Skipping loading plugin due to problem with signature",
				"pluginID", plugin.ID, "status", signingError.SignatureStatus)
			plugin.SignatureError = signingError
			l.errs[plugin.ID] = signingError
			// skip plugin so it will not be loaded any further
			continue
		}

		// clear plugin error if a pre-existing error has since been resolved
		delete(l.errs, plugin.ID)

		// verify module.js exists for SystemJS to load
		if !plugin.IsRenderer() && !plugin.IsCorePlugin() {
			module := filepath.Join(plugin.PluginDir, "module.js")
			if exists, err := fs.Exists(module); err != nil {
				return nil, err
			} else if !exists {
				logger.Warn("Plugin missing module.js",
					"pluginID", plugin.ID,
					"warning", "Missing module.js, If you loaded this plugin from git, make sure to compile it.",
					"path", module)
			}
		}

		verifiedPlugins = append(verifiedPlugins, plugin)
	}

	for _, p := range verifiedPlugins {
		err := l.pluginInitializer.Initialize(p)
		if err != nil {
			return nil, err
		}
	}

	return verifiedPlugins, nil
}

func (l *Loader) readPluginJSON(pluginJSONPath string) (plugins.JSONData, error) {
	logger.Debug("Loading plugin", "path", pluginJSONPath)

	if !strings.EqualFold(filepath.Ext(pluginJSONPath), ".json") {
		return plugins.JSONData{}, ErrInvalidPluginJSONFilePath
	}

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `currentPath` is based
	// on plugin the folder structure on disk and not user input.
	reader, err := os.Open(pluginJSONPath)
	if err != nil {
		return plugins.JSONData{}, err
	}

	plugin := plugins.JSONData{}
	if err := json.NewDecoder(reader).Decode(&plugin); err != nil {
		return plugins.JSONData{}, err
	}

	if err := reader.Close(); err != nil {
		logger.Warn("Failed to close JSON file", "path", pluginJSONPath, "err", err)
	}

	if err := validatePluginJSON(plugin); err != nil {
		return plugins.JSONData{}, err
	}

	if plugin.ID == "grafana-piechart-panel" {
		plugin.Name = "Pie Chart (old)"
	}

	return plugin, nil
}

func (l *Loader) PluginErrors() []*plugins.Error {
	errs := make([]*plugins.Error, 0)
	for _, err := range l.errs {
		errs = append(errs, &plugins.Error{
			PluginID:  err.PluginID,
			ErrorCode: err.AsErrorCode(),
		})
	}

	return errs
}

func validatePluginJSON(data plugins.JSONData) error {
	if data.ID == "" || !data.Type.IsValid() {
		return ErrInvalidPluginJSON
	}
	return nil
}

func (l *Loader) pluginClass(pluginDir string) plugins.Class {
	isSubDir := func(base, target string) bool {
		path, err := filepath.Rel(base, target)
		if err != nil {
			return false
		}

		if !strings.HasPrefix(path, "..") {
			return true
		}

		return false
	}

	corePluginsDir := filepath.Join(l.cfg.StaticRootPath, "app/plugins")
	if isSubDir(corePluginsDir, pluginDir) {
		return plugins.Core
	}

	if isSubDir(l.cfg.BundledPluginsPath, pluginDir) {
		return plugins.Bundled
	}

	return plugins.External
}

type foundPlugins map[string]plugins.JSONData

// stripDuplicates will strip duplicate plugins or plugins that already exist
func (f *foundPlugins) stripDuplicates(existingPlugins map[string]struct{}) {
	pluginsByID := make(map[string]struct{})
	for path, scannedPlugin := range *f {
		if _, existing := existingPlugins[scannedPlugin.ID]; existing {
			logger.Debug("Skipping plugin as it's already installed", "plugin", scannedPlugin.ID)
			delete(*f, path)
			continue
		}

		pluginsByID[scannedPlugin.ID] = struct{}{}
	}
}
