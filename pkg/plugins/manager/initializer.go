package manager

import (
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"

	"github.com/gosimple/slug"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Initializer struct {
	Cfg     *setting.Cfg     `inject:""`
	License models.Licensing `inject:""`

	log log.Logger
}

func init() {
	registry.Register(&registry.Descriptor{
		Name: "PluginInitializer",
		Instance: &Initializer{
			log: log.New("plugin.initializer"),
		},
		InitPriority: registry.MediumHigh,
	})
}

func (i *Initializer) Init() error {
	return nil
}

func (i *Initializer) Initialize(p *plugins.PluginV2) error {
	if len(p.Dependencies.Plugins) == 0 {
		p.Dependencies.Plugins = []plugins.PluginDependencyItem{}
	}

	if p.Dependencies.GrafanaVersion == "" {
		p.Dependencies.GrafanaVersion = "*"
	}

	for _, include := range p.Includes {
		if include.Role == "" {
			include.Role = models.ROLE_VIEWER
		}
	}

	i.handleModuleDefaults(p)

	p.Info.Logos.Small = getPluginLogoUrl(p.Type, p.Info.Logos.Small, p.BaseUrl)
	p.Info.Logos.Large = getPluginLogoUrl(p.Type, p.Info.Logos.Large, p.BaseUrl)

	for i := 0; i < len(p.Info.Screenshots); i++ {
		p.Info.Screenshots[i].Path = evalRelativePluginUrlPath(p.Info.Screenshots[i].Path, p.BaseUrl, p.Type)
	}

	if p.Type == "app" {
		for _, child := range p.Children {
			i.setPathsBasedOnApp(p, child)
		}

		// slugify pages
		for _, include := range p.Includes {
			if include.Slug == "" {
				include.Slug = slug.Make(include.Name)
			}
			if include.Type == "page" && include.DefaultNav {
				p.DefaultNavURL = i.Cfg.AppSubURL + "/plugins/" + p.ID + "/page/" + include.Slug
			}
			if include.Type == "dashboard" && include.DefaultNav {
				p.DefaultNavURL = i.Cfg.AppSubURL + "/dashboard/db/" + include.Slug
			}
		}
	}

	if !p.IsCorePlugin() {
		i.log.Info(fmt.Sprintf("Successfully added %s plugin", p.Class), "pluginID", p.ID)
	}

	if p.Backend {
		var backendFactory backendplugin.PluginFactoryFunc
		if p.IsRenderer() {
			cmd := plugins.ComposeRendererStartCommand()
			backendFactory = grpcplugin.NewRendererPlugin(p.ID, filepath.Join(p.PluginDir, cmd),
				func(pluginID string, renderer pluginextensionv2.RendererPlugin, logger log.Logger) error {
					p.Renderer = renderer
					return nil
				},
			)
		} else {
			cmd := plugins.ComposePluginStartCommand(p.Executable)
			backendFactory = grpcplugin.NewBackendPlugin(p.ID, filepath.Join(p.PluginDir, cmd))
		}

		env := i.getPluginEnvVars(p)
		if backendClient, err := backendFactory(p.ID, i.log.New("pluginID", p.ID), env); err != nil {
			return err
		} else {
			p.Client = backendClient
		}
	}

	return nil
}

func (i *Initializer) handleModuleDefaults(p *plugins.PluginV2) {
	if isExternalPlugin(p.PluginDir, i.Cfg) {
		metrics.SetPluginBuildInformation(p.ID, p.Type, p.Info.Version, string(p.Signature))

		p.Module = path.Join("plugins", p.ID, "module")
		p.BaseUrl = path.Join("public/plugins", p.ID)
		return
	}

	// Previously there was an assumption that the plugin directory
	// should be public/app/plugins/<plugin type>/<plugin id>
	// However this can be an issue if the plugin directory should be renamed to something else
	currentDir := filepath.Base(p.PluginDir)
	// use path package for the following statements
	// because these are not file paths
	p.Module = path.Join("app/plugins", p.Type, currentDir, "module")
	p.BaseUrl = path.Join("public/app/plugins", p.Type, currentDir)
}

func (i *Initializer) setPathsBasedOnApp(parent *plugins.PluginV2, child *plugins.PluginV2) {
	appSubPath := strings.ReplaceAll(strings.Replace(child.PluginDir, parent.PluginDir, "", 1), "\\", "/")
	child.IncludedInAppID = parent.ID
	child.BaseUrl = parent.BaseUrl

	if isExternalPlugin(parent.PluginDir, i.Cfg) {
		child.Module = util.JoinURLFragments("plugins/"+parent.ID, appSubPath) + "/module"
	} else {
		child.Module = util.JoinURLFragments("app/plugins/app/"+parent.ID, appSubPath) + "/module"
	}
}

func getPluginLogoUrl(pluginType, path, baseUrl string) string {
	if path == "" {
		return defaultLogoPath(pluginType)
	}

	return evalRelativePluginUrlPath(path, baseUrl, pluginType)
}

func defaultLogoPath(pluginType string) string {
	return "public/img/icn-" + pluginType + ".svg"
}

func isExternalPlugin(pluginDir string, cfg *setting.Cfg) bool {
	return !strings.Contains(pluginDir, cfg.StaticRootPath)
}

func evalRelativePluginUrlPath(pathStr, baseUrl, pluginType string) string {
	if pathStr == "" {
		return ""
	}

	u, _ := url.Parse(pathStr)
	if u.IsAbs() {
		return pathStr
	}

	// is set as default or has already been prefixed with base path
	if pathStr == defaultLogoPath(pluginType) || strings.HasPrefix(pathStr, baseUrl) {
		return pathStr
	}

	return path.Join(baseUrl, pathStr)
}

func (i *Initializer) getPluginEnvVars(plugin *plugins.PluginV2) []string {
	hostEnv := []string{
		fmt.Sprintf("GF_VERSION=%s", i.Cfg.BuildVersion),
		fmt.Sprintf("GF_EDITION=%s", i.License.Edition()),
	}

	if i.License.HasLicense() {
		hostEnv = append(
			hostEnv,
			fmt.Sprintf("GF_ENTERPRISE_LICENSE_PATH=%s", i.Cfg.EnterpriseLicensePath),
		)

		if envProvider, ok := i.License.(models.LicenseEnvironment); ok {
			for k, v := range envProvider.Environment() {
				hostEnv = append(hostEnv, fmt.Sprintf("%s=%s", k, v))
			}
		}
	}

	hostEnv = append(hostEnv, i.getAWSEnvironmentVariables()...)
	hostEnv = append(hostEnv, i.getAzureEnvironmentVariables()...)
	env := getPluginSettings(plugin.ID, i.Cfg).ToEnv("GF_PLUGIN", hostEnv)
	return env
}

func (i *Initializer) getAWSEnvironmentVariables() []string {
	var variables []string
	if i.Cfg.AWSAssumeRoleEnabled {
		variables = append(variables, awsds.AssumeRoleEnabledEnvVarKeyName+"=true")
	}
	if len(i.Cfg.AWSAllowedAuthProviders) > 0 {
		variables = append(variables, awsds.AllowedAuthProvidersEnvVarKeyName+"="+strings.Join(i.Cfg.AWSAllowedAuthProviders, ","))
	}

	return variables
}

func (i *Initializer) getAzureEnvironmentVariables() []string {
	var variables []string
	if i.Cfg.Azure.Cloud != "" {
		variables = append(variables, "AZURE_CLOUD="+i.Cfg.Azure.Cloud)
	}
	if i.Cfg.Azure.ManagedIdentityClientId != "" {
		variables = append(variables, "AZURE_MANAGED_IDENTITY_CLIENT_ID="+i.Cfg.Azure.ManagedIdentityClientId)
	}
	if i.Cfg.Azure.ManagedIdentityEnabled {
		variables = append(variables, "AZURE_MANAGED_IDENTITY_ENABLED=true")
	}

	return variables
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
