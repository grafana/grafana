package manager

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

var pluginTypes = map[string]interface{}{
	"panel":      plugins.PanelPlugin{},
	"datasource": plugins.DataSourcePlugin{},
	"app":        plugins.AppPlugin{},
	"renderer":   plugins.RendererPlugin{},
}

type Loader struct {
	Cfg                  *setting.Cfg          `inject:""`
	BackendPluginManager backendplugin.Manager `inject:""`

	allowUnsignedPluginsCondition unsignedPluginConditionFunc
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

func (l *Loader) Load(pluginJSONPath string, requireSigned bool) (*plugins.PluginBase, error) {
	p, err := l.LoadAll([]string{pluginJSONPath}, requireSigned)
	if err != nil {
		return nil, err
	}

	return p[0], nil
}

func (l *Loader) LoadAll(pluginJSONPaths []string, requireSigned bool) ([]*plugins.PluginBase, error) {
	var foundPlugins = make(map[string]*plugins.PluginBase)

	for _, pluginJSONPath := range pluginJSONPaths {
		l.log.Debug("Loading plugin", "path", pluginJSONPath)
		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `currentPath` is based
		// on plugin the folder structure on disk and not user input.
		reader, err := os.Open(pluginJSONPath)
		if err != nil {
			return nil, err
		}

		plugin := &plugins.PluginBase{}
		if err := json.NewDecoder(reader).Decode(&plugin); err != nil {
			return nil, err
		}

		if err := reader.Close(); err != nil {
			l.log.Warn("Failed to close JSON file", "path", pluginJSONPath, "err", err)
		}

		if plugin.Id == "" || plugin.Type == "" {
			return nil, errors.New("did not find type or id properties in plugin.json")
		}

		plugin.PluginDir = filepath.Dir(pluginJSONPath)
		signatureState, err := GetPluginSignatureState(l.log, plugin)
		if err != nil {
			l.log.Warn("Could not get plugin signature state", "pluginID", plugin.Id, "err", err)
			return nil, err
		}
		plugin.Signature = signatureState.Status
		plugin.SignatureType = signatureState.Type
		plugin.SignatureOrg = signatureState.SigningOrg

		foundPlugins[filepath.Dir(pluginJSONPath)] = plugin
	}

	// wire up plugin dependencies
	for _, plugin := range foundPlugins {
		ancestors := strings.Split(plugin.PluginDir, string(filepath.Separator))
		ancestors = ancestors[0 : len(ancestors)-1]
		aPath := ""

		if runtime.GOOS != "windows" && filepath.IsAbs(plugin.PluginDir) {
			aPath = "/"
		}
		for _, a := range ancestors {
			aPath = filepath.Join(aPath, a)
			if parent, ok := foundPlugins[aPath]; ok {
				plugin.Root = parent
				//plugin.Parent.Children = append(plugin.Parent.Children, plugin)
				break
			}
		}
	}

	// start of second pass
	for _, plugin := range foundPlugins {
		l.log.Debug("Found plugin", "id", plugin.Id, "signature", plugin.Signature, "hasParent", plugin.Root != nil)
		signingError := newSignatureValidator(l.Cfg, requireSigned, l.allowUnsignedPluginsCondition).validate(plugin)
		if signingError != nil {
			l.log.Debug("Failed to validate plugin signature. Will skip loading", "id", plugin.Id,
				"signature", plugin.Signature, "status", signingError.ErrorCode)
			//pm.pluginScanningErrors[plugin.Id] = *signingError
			return nil, nil // collect scanning error
		}

		l.log.Debug("Attempting to add plugin", "id", plugin.Id)

		pluginJSONPath := filepath.Join(plugin.PluginDir, "plugin.json")

		// External plugins need a module.js file for SystemJS to load
		if !strings.HasPrefix(pluginJSONPath, l.Cfg.StaticRootPath) && !isRendererPlugin(plugin.Type) {
			module := filepath.Join(plugin.PluginDir, "module.js")
			exists, err := fs.Exists(module)
			if err != nil {
				return nil, err
			}
			if !exists {
				l.log.Warn("Plugin missing module.js",
					"name", plugin.Name,
					"warning", "Missing module.js, If you loaded this plugin from git, make sure to compile it.",
					"path", module)
			}
		}

		reader, err := os.Open(pluginJSONPath)
		if err != nil {
			return nil, err
		}
		defer func() {
			if err := reader.Close(); err != nil {
				logger.Warn("Failed to close JSON file", "path", pluginJSONPath, "err", err)
			}
		}()
		jsonParser := json.NewDecoder(reader)

		pluginGoType, exists := pluginTypes[plugin.Type]
		if !exists {
			return nil, fmt.Errorf("unknown plugin type %q", plugin.Type)
		}
		loader := reflect.New(reflect.TypeOf(pluginGoType)).Interface().(plugins.PluginLoader)

		if err := jsonParser.Decode(loader); err != nil {
			return nil, err
		}

		_, err = loader.Load(jsonParser, plugin, l.BackendPluginManager)
		if err != nil {
			return nil, err
		}

		//if p, exists := pm.plugins[pb.Id]; exists {
		//	l.log.Warn("Plugin is duplicate", "id", pb.Id)
		//	scanner.errors = append(scanner.errors, plugins.DuplicatePluginError{Plugin: pb, ExistingPlugin: p})
		//	return nil, nil // return duplicate error?
		//}

		if !strings.HasPrefix(plugin.PluginDir, l.Cfg.StaticRootPath) {
			l.log.Info("Registering plugin", "id", plugin.Id)
		}

		if len(plugin.Dependencies.Plugins) == 0 {
			plugin.Dependencies.Plugins = []plugins.PluginDependencyItem{}
		}

		if plugin.Dependencies.GrafanaVersion == "" {
			plugin.Dependencies.GrafanaVersion = "*"
		}

		for _, include := range plugin.Includes {
			if include.Role == "" {
				include.Role = models.ROLE_VIEWER
			}
		}

		l.log.Debug("Successfully added plugin", "id", plugin.Id)

		//if len(scanner.errors) > 0 {
		//	l.log.Warn("Some plugins failed to load", "errors", scanner.errors)
		//	pm.scanningErrors = scanner.errors
		//}
	}

	res := make([]*plugins.PluginBase, 0, len(foundPlugins))

	for _, p := range foundPlugins {
		res = append(res, p)
	}

	return res, nil
}

func isRendererPlugin(pluginType string) bool {
	return pluginType == "renderer"
}
