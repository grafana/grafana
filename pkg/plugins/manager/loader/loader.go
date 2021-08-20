package loader

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger                    = log.New("plugin.loader")
	InvalidPluginJSON         = errors.New("did not find valid type or id properties in plugin.json")
	InvalidPluginJSONFilePath = errors.New("invalid plugin.json filepath was provided")
)

type Loader struct {
	cfg          *setting.Cfg
	pluginFinder finder.Finder

	errs map[string]error
	// allowUnsignedPluginsCondition changes the policy for allowing unsigned plugins. Signature validation only
	// runs when plugins are starting, therefore running plugins will not be terminated if they violate the new policy.
	allowUnsignedPluginsCondition signature.UnsignedPluginConditionFunc
}

func New(allowUnsignedPluginsCondition signature.UnsignedPluginConditionFunc, cfg *setting.Cfg) Loader {
	return Loader{
		cfg:                           cfg,
		pluginFinder:                  finder.New(cfg),
		allowUnsignedPluginsCondition: allowUnsignedPluginsCondition,
		errs:                          make(map[string]error),
	}
}

func (l *Loader) Init() error {
	return nil
}

func (l *Loader) Load(path string) (*plugins.PluginV2, error) {
	pluginJSONPaths, err := l.pluginFinder.Find(path)
	if err != nil {
		logger.Error("plugin finder encountered an error", "err", err)
	}

	loadedPlugins, err := l.loadPlugins(pluginJSONPaths)
	if err != nil {
		return nil, err
	}
	return loadedPlugins[0], nil
}

func (l *Loader) LoadAll(path string) ([]*plugins.PluginV2, error) {
	pluginJSONPaths, err := l.pluginFinder.Find(path)
	if err != nil {
		logger.Error("plugin finder encountered an error", "err", err)
	}

	return l.loadPlugins(pluginJSONPaths)
}

func (l *Loader) loadPlugins(pluginJSONPaths []string) ([]*plugins.PluginV2, error) {
	var foundPlugins = make(map[string]plugins.JSONData)

	// load plugin.json files and map directory to JSON data map
	for _, pluginJSONPath := range pluginJSONPaths {
		plugin, err := l.readPluginJSON(pluginJSONPath)
		if err != nil {
			return nil, err
		}

		pluginJSONAbsPath, err := filepath.Abs(pluginJSONPath)
		if err != nil {
			return nil, err
		}

		foundPlugins[filepath.Dir(pluginJSONAbsPath)] = plugin
	}

	// calculate initial signature state
	loadedPlugins := make(map[string]*plugins.PluginV2)
	for pluginDir, pluginJSON := range foundPlugins {
		plugin := &plugins.PluginV2{
			JSONData:  pluginJSON,
			PluginDir: pluginDir,
			Class:     l.pluginClass(pluginDir),
		}

		signatureState, err := signature.CalculateState(logger, plugin)
		if err != nil {
			logger.Warn("Could not get plugin signature state", "pluginID", plugin.ID, "err", err)
			return nil, err
		}
		plugin.Signature = signatureState.Status
		plugin.SignatureType = signatureState.Type
		plugin.SignatureOrg = signatureState.SigningOrg

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

		logger.Debug("Found plugin", "id", plugin.ID, "signature", plugin.Signature, "hasParent", plugin.Parent != nil)
	}

	// validate signatures
	for _, plugin := range loadedPlugins {
		signingError := signature.NewValidator(l.cfg, plugin.Class, l.allowUnsignedPluginsCondition).Validate(plugin)
		if signingError != nil {
			logger.Debug("Failed to validate plugin signature. Will skip loading", "id", plugin.ID,
				"signature", plugin.Signature, "status", signingError)
			l.errs[plugin.ID] = signingError
			continue
		}

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
	}

	if len(l.errs) > 0 {
		var errStr []string
		for _, err := range l.errs {
			errStr = append(errStr, err.Error())
		}
		logger.Warn("Some plugin loading errors occurred", "errors", strings.Join(errStr, ", "))
	}

	res := make([]*plugins.PluginV2, 0, len(loadedPlugins))
	for _, p := range loadedPlugins {
		logger.Debug("Loaded plugin", "pluginID", p.ID)

		res = append(res, p)
	}

	return res, nil
}

func (l *Loader) readPluginJSON(pluginJSONPath string) (plugins.JSONData, error) {
	logger.Debug("Loading plugin", "path", pluginJSONPath)

	if !strings.EqualFold(filepath.Ext(pluginJSONPath), ".json") {
		return plugins.JSONData{}, InvalidPluginJSONFilePath
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

	return plugin, nil
}

func (l *Loader) Errors() map[string]error {
	return l.errs
}

func validatePluginJSON(data plugins.JSONData) error {
	if data.ID == "" || !data.Type.IsValid() {
		return InvalidPluginJSON
	}
	return nil
}

func (l *Loader) pluginClass(pluginDir string) plugins.PluginClass {
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

	if isSubDir(l.cfg.PluginsPath, pluginDir) {
		return plugins.External
	}

	return plugins.Unknown
}
