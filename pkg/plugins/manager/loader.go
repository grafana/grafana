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

func (l *Loader) Load(pluginJSONPath string, requireSigned bool) (*plugins.PluginV2, error) {
	p, err := l.LoadAll([]string{pluginJSONPath}, requireSigned)
	if err != nil {
		return nil, err
	}

	return p[0], nil
}

func (l *Loader) LoadAll(pluginJSONPaths []string, requireSigned bool) ([]*plugins.PluginV2, error) {
	var foundPlugins = make(map[string]plugins.JSONData)
	var loadingErrors = make(map[string]error)

	for _, pluginJSONPath := range pluginJSONPaths {
		plugin, err := l.readPluginJSON(pluginJSONPath)
		if err != nil {
			return nil, err
		}

		foundPlugins[filepath.Dir(pluginJSONPath)] = plugin
	}

	pluginsByID := make(map[string]struct{})
	for scannedPluginPath, scannedPlugin := range foundPlugins {
		// Check if scanning found duplicate plugins
		if _, dupe := pluginsByID[scannedPlugin.ID]; dupe {
			l.log.Warn("Skipping plugin as it's a duplicate", "id", scannedPlugin.ID)
			loadingErrors[scannedPlugin.ID] = plugins.DuplicatePluginError{ExistingPluginDir: scannedPluginPath, PluginID: scannedPlugin.ID}
			delete(foundPlugins, scannedPluginPath)
			continue
		}
		pluginsByID[scannedPlugin.ID] = struct{}{}

		// Probably move this whole logic to higher-level (let manager decide)
		// Check if scanning found plugins that are already installed
		//if existing := pm.GetPlugin(scannedPlugin.ID); existing != nil {
		//	l.log.Debug("Skipping plugin as it's already installed", "plugin", existing.ID, "version", existing.Info.Version)
		//	delete(foundPlugins, scannedPluginPath)
		//}
	}

	// wire up plugin dependencies
	loadedPlugins := make(map[string]*plugins.PluginV2)
	for pluginDir, pluginJSON := range foundPlugins {
		p := &plugins.PluginV2{
			JSONData:  pluginJSON,
			PluginDir: pluginDir,
		}

		children := strings.Split(p.PluginDir, string(filepath.Separator))
		children = children[0 : len(children)-1]
		pluginPath := ""

		if runtime.GOOS != "windows" && filepath.IsAbs(p.PluginDir) {
			pluginPath = "/"
		}
		for _, child := range children {
			pluginPath = filepath.Join(pluginPath, child)
			if parentPluginJSON, ok := foundPlugins[pluginPath]; ok {
				p.Parent = &plugins.PluginV2{
					JSONData:  parentPluginJSON,
					PluginDir: pluginPath,
				}
				p.Parent.Children = append(p.Parent.Children, p)
				break
			}
		}
		loadedPlugins[p.PluginDir] = p
	}

	// start of second pass
	for _, plugin := range loadedPlugins {
		signatureState, err := pluginSignatureState(l.log, l.Cfg, plugin)
		if err != nil {
			l.log.Warn("Could not get plugin signature state", "pluginID", plugin.ID, "err", err)
			return nil, err
		}
		plugin.Signature = signatureState.Status
		plugin.SignatureType = signatureState.Type
		plugin.SignatureOrg = signatureState.SigningOrg

		l.log.Debug("Found plugin", "id", plugin.ID, "signature", plugin.Signature, "hasParent", plugin.Parent != nil)
		signingError := newSignatureValidator(l.Cfg, requireSigned, l.allowUnsignedPluginsCondition).validate(plugin)
		if signingError != nil {
			l.log.Debug("Failed to validate plugin signature. Will skip loading", "id", plugin.ID,
				"signature", plugin.Signature, "status", signingError)
			loadingErrors[plugin.ID] = signingError
			continue
		}

		if plugin.Signature.IsInternal() {
			plugin.IsCorePlugin = true
		}

		// External plugins need a module.js file for SystemJS to load
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

		logger.Debug("Loaded plugin", "pluginID", plugin.ID)

		//if len(scanner.errors) > 0 {
		//	l.log.Warn("Some plugins failed to load", "errors", scanner.errors)
		//	pm.scanningErrors = scanner.errors
		//}
	}

	if len(loadingErrors) > 0 {
		var errStr []string
		for _, err := range loadingErrors {
			errStr = append(errStr, err.Error())
		}
		logger.Warn("Some plugin loading errors were found", "errors", strings.Join(errStr, ", "))
	}

	res := make([]*plugins.PluginV2, 0, len(loadedPlugins))
	for _, p := range loadedPlugins {
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
