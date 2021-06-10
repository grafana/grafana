package manager

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

type Loader struct {
	Cfg     *setting.Cfg     `inject:""`
	License models.Licensing `inject:""`

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
	var foundPlugins = make(map[string]*plugins.PluginV2)

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
			//scanner.errors = append(scanner.errors, plugins.DuplicatePluginError{PluginID: scannedPlugin.Id, ExistingPluginDir: scannedPlugin.PluginDir})
			delete(foundPlugins, scannedPluginPath)
			continue
		}
		pluginsByID[scannedPlugin.ID] = struct{}{}

		// Check if scanning found plugins that are already installed
		//if existing := pm.GetPlugin(scannedPlugin.ID); existing != nil {
		//	l.log.Debug("Skipping plugin as it's already installed", "plugin", existing.ID, "version", existing.Info.Version)
		//	delete(foundPlugins, scannedPluginPath)
		//}
	}

	// wire up plugin dependencies
	for pluginDir, plugin := range foundPlugins {
		plugin.PluginDir = pluginDir
		children := strings.Split(plugin.PluginDir, string(filepath.Separator))
		children = children[0 : len(children)-1]
		pluginPath := ""

		if runtime.GOOS != "windows" && filepath.IsAbs(plugin.PluginDir) {
			pluginPath = "/"
		}
		for _, child := range children {
			pluginPath = filepath.Join(pluginPath, child)
			if parent, ok := foundPlugins[pluginPath]; ok {
				plugin.Parent = parent
				plugin.Parent.Children = append(plugin.Parent.Children, plugin)
				break
			}
		}
	}

	// start of second pass
	for _, plugin := range foundPlugins {
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
				"signature", plugin.Signature, "status", signingError.ErrorCode)
			//pm.pluginScanningErrors[plugin.Id] = *signingError
			return nil, nil
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

		if plugin.Backend {
			var backendFactory backendplugin.PluginFactoryFunc
			if plugin.IsRenderer() {
				cmd := plugins.ComposeRendererStartCommand()
				backendFactory = grpcplugin.NewRendererPlugin(plugin.ID, filepath.Join(plugin.PluginDir, cmd),
					func(pluginID string, renderer pluginextensionv2.RendererPlugin, logger log.Logger) error {
						//TODO
						return nil
					},
				)
			} else {
				cmd := plugins.ComposePluginStartCommand(plugin.Executable)
				backendFactory = grpcplugin.NewBackendPlugin(plugin.ID, filepath.Join(plugin.PluginDir, cmd))
			}

			env := l.getPluginEnvVars(plugin)
			if backendClient, err := backendFactory(plugin.ID, l.log.New("pluginID", plugin.ID), env); err != nil {
				return nil, err
			} else {
				plugin.Client = backendClient
			}
		}

		logger.Debug("Loaded plugin", "pluginID", plugin.ID)

		//if len(scanner.errors) > 0 {
		//	l.log.Warn("Some plugins failed to load", "errors", scanner.errors)
		//	pm.scanningErrors = scanner.errors
		//}
	}

	res := make([]*plugins.PluginV2, 0, len(foundPlugins))

	for _, p := range foundPlugins {
		res = append(res, p)
	}

	return res, nil
}

func (l *Loader) readPluginJSON(pluginJSONPath string) (*plugins.PluginV2, error) {
	l.log.Debug("Loading plugin", "path", pluginJSONPath)

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `currentPath` is based
	// on plugin the folder structure on disk and not user input.
	reader, err := os.Open(pluginJSONPath)
	if err != nil {
		return nil, err
	}

	plugin := &plugins.PluginV2{}
	if err := json.NewDecoder(reader).Decode(&plugin); err != nil {
		return nil, err
	}

	if err := reader.Close(); err != nil {
		l.log.Warn("Failed to close JSON file", "path", pluginJSONPath, "err", err)
	}

	if !isValidPluginJSON(plugin.JSONData) {
		return nil, errors.New("did not find type or id properties in plugin.json")
	}

	return plugin, nil
}

func (l *Loader) getPluginEnvVars(plugin *plugins.PluginV2) []string {
	hostEnv := []string{
		fmt.Sprintf("GF_VERSION=%s", l.Cfg.BuildVersion),
		fmt.Sprintf("GF_EDITION=%s", l.License.Edition()),
	}

	if l.License.HasLicense() {
		hostEnv = append(
			hostEnv,
			fmt.Sprintf("GF_ENTERPRISE_LICENSE_PATH=%s", l.Cfg.EnterpriseLicensePath),
		)

		if envProvider, ok := l.License.(models.LicenseEnvironment); ok {
			for k, v := range envProvider.Environment() {
				hostEnv = append(hostEnv, fmt.Sprintf("%s=%s", k, v))
			}
		}
	}

	hostEnv = append(hostEnv, l.getAWSEnvironmentVariables()...)
	hostEnv = append(hostEnv, l.getAzureEnvironmentVariables()...)
	env := getPluginSettings(plugin.ID, l.Cfg).ToEnv("GF_PLUGIN", hostEnv)
	return env
}

func (l *Loader) getAWSEnvironmentVariables() []string {
	var variables []string
	if l.Cfg.AWSAssumeRoleEnabled {
		variables = append(variables, awsds.AssumeRoleEnabledEnvVarKeyName+"=true")
	}
	if len(l.Cfg.AWSAllowedAuthProviders) > 0 {
		variables = append(variables, awsds.AllowedAuthProvidersEnvVarKeyName+"="+strings.Join(l.Cfg.AWSAllowedAuthProviders, ","))
	}

	return variables
}

func (l *Loader) getAzureEnvironmentVariables() []string {
	var variables []string
	if l.Cfg.Azure.Cloud != "" {
		variables = append(variables, "AZURE_CLOUD="+l.Cfg.Azure.Cloud)
	}
	if l.Cfg.Azure.ManagedIdentityClientId != "" {
		variables = append(variables, "AZURE_MANAGED_IDENTITY_CLIENT_ID="+l.Cfg.Azure.ManagedIdentityClientId)
	}
	if l.Cfg.Azure.ManagedIdentityEnabled {
		variables = append(variables, "AZURE_MANAGED_IDENTITY_ENABLED=true")
	}

	return variables
}

func isValidPluginJSON(data plugins.JSONData) bool {
	if data.ID == "" || data.Type == "" {
		return false
	}
	return true
}

type pluginSettings map[string]string

func (ps pluginSettings) ToEnv(prefix string, hostEnv []string) []string {
	var env []string
	for k, v := range ps {
		key := fmt.Sprintf("%s_%s", prefix, strings.ToUpper(k))
		if value := os.Getenv(key); value != "" {
			v = value
		}

		env = append(env, fmt.Sprintf("%s=%s", key, v))
	}

	env = append(env, hostEnv...)

	return env
}

func getPluginSettings(plugID string, cfg *setting.Cfg) pluginSettings {
	ps := pluginSettings{}
	for k, v := range cfg.PluginSettings[plugID] {
		if k == "path" || strings.ToLower(k) == "id" {
			continue
		}

		ps[k] = v
	}

	return ps
}
