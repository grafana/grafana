package manager

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
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

type Loader struct {
	Cfg *setting.Cfg `inject:""`

	allowUnsignedPluginsCondition unsignedPluginV2ConditionFunc
	log                           log.Logger
}

func init() {
	registry.Register(&registry.Descriptor{
		Name: "PluginLoader",
		Instance: &Loader{
			log: log.New("plugin.loader"),
		},
		InitPriority: registry.MediumHigh,
	})
}

func (l *Loader) Init() error {
	return nil
}

func (l *Loader) Load(pluginJSONPath string, class plugins.PluginClass) (*plugins.PluginV2, error) {
	p, err := l.LoadAll([]string{pluginJSONPath}, class)
	if err != nil {
		return nil, err
	}

	return p[0], nil
}

func (l *Loader) LoadAll(pluginJSONPaths []string, class plugins.PluginClass) ([]*plugins.PluginV2, error) {
	var foundPlugins = make(map[string]plugins.JSONData)
	var loadingErrors = make(map[string]error)

	// load plugin.json files and map directory to JSON data map
	for _, pluginJSONPath := range pluginJSONPaths {
		plugin, err := l.readPluginJSON(pluginJSONPath)
		if err != nil {
			return nil, err
		}

		foundPlugins[filepath.Dir(pluginJSONPath)] = plugin
	}

	// calculate initial signature state
	loadedPlugins := make(map[string]*plugins.PluginV2)
	for pluginDir, pluginJSON := range foundPlugins {
		plugin := &plugins.PluginV2{
			JSONData:  pluginJSON,
			PluginDir: pluginDir,
			Class:     class,
		}

		signatureState, err := pluginSignatureState(l.log, l.Cfg, plugin)
		if err != nil {
			l.log.Warn("Could not get plugin signature state", "pluginID", plugin.ID, "err", err)
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
				plugin.Parent = &plugins.PluginV2{
					JSONData:  parentPlugin.JSONData,
					PluginDir: pluginPath,
				}
				plugin.Parent.Children = append(plugin.Parent.Children, plugin)
				break
			}
		}

		l.log.Debug("Found plugin", "id", plugin.ID, "signature", plugin.Signature, "hasParent", plugin.Parent != nil)
	}

	// validate signatures
	for _, plugin := range loadedPlugins {
		signingError := newSignatureValidator(l.Cfg, class, l.allowUnsignedPluginsCondition).validate(plugin)
		if signingError != nil {
			l.log.Debug("Failed to validate plugin signature. Will skip loading", "id", plugin.ID,
				"signature", plugin.Signature, "status", signingError)
			loadingErrors[plugin.ID] = signingError
			continue
		}

		// verify module.js exists for SystemJS to load
		if isExternalPlugin(plugin.PluginDir, l.Cfg) && !plugin.IsRenderer() {
			module := filepath.Join(plugin.PluginDir, "module.js")
			if exists, err := fs.Exists(module); err != nil {
				return nil, err
			} else if !exists {
				l.log.Warn("Plugin missing module.js",
					"pluginID", plugin.ID,
					"warning", "Missing module.js, If you loaded this plugin from git, make sure to compile it.",
					"path", module)
			}
		}
	}

	if len(loadingErrors) > 0 {
		var errStr []string
		for _, err := range loadingErrors {
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
	l.log.Debug("Loading plugin", "path", pluginJSONPath)

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
		l.log.Warn("Failed to close JSON file", "path", pluginJSONPath, "err", err)
	}

	if !isValidPluginJSON(plugin) {
		return plugins.JSONData{}, errors.New("did not find type or id properties in plugin.json")
	}

	return plugin, nil
}

func isValidPluginJSON(data plugins.JSONData) bool {
	if data.ID == "" || data.Type == "" {
		return false
	}
	return true
}
