package manager

import (
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/gosimple/slug"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Initializer struct {
	Cfg                  *setting.Cfg          `inject:""`
	BackendPluginManager backendplugin.Manager `inject:""`

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

func (l *Initializer) Init() error {
	return nil
}

// Can this step be actually done through pointer receiver?
func (l *Initializer) Initialize(p *plugins.PluginV2) error {
	l.handleModuleDefaults(p)

	p.Info.Logos.Small = getPluginLogoUrl(p.Type, p.Info.Logos.Small, p.BaseUrl)
	p.Info.Logos.Large = getPluginLogoUrl(p.Type, p.Info.Logos.Large, p.BaseUrl)

	for i := 0; i < len(p.Info.Screenshots); i++ {
		p.Info.Screenshots[i].Path = evalRelativePluginUrlPath(p.Info.Screenshots[i].Path, p.BaseUrl)
	}

	if p.Type == "app" {
		for _, child := range p.Children {
			l.setPathsBasedOnApp(p, child)
		}

		// slugify pages
		for _, include := range p.Includes {
			if include.Slug == "" {
				include.Slug = slug.Make(include.Name)
			}
			if include.Type == "page" && include.DefaultNav {
				p.DefaultNavURL = l.Cfg.AppSubURL + "/plugins/" + p.ID + "/page/" + include.Slug
			}
			if include.Type == "dashboard" && include.DefaultNav {
				p.DefaultNavURL = l.Cfg.AppSubURL + "/dashboard/db/" + include.Slug
			}
		}
	}

	return nil
}

func (l *Initializer) handleModuleDefaults(p *plugins.PluginV2) {
	if isExternalPlugin(p.PluginDir, l.Cfg) {
		metrics.SetPluginBuildInformation(p.ID, p.Type, p.Info.Version)

		p.Module = path.Join("plugins", p.ID, "module")
		p.BaseUrl = path.Join("public/plugins", p.ID)
		return
	}

	p.IsCorePlugin = true
	p.Signature = plugins.PluginSignatureInternal

	// Previously there was an assumption that the plugin directory
	// should be public/app/plugins/<plugin type>/<plugin id>
	// However this can be an issue if the plugin directory should be renamed to something else
	currentDir := filepath.Base(p.PluginDir)
	// use path package for the following statements
	// because these are not file paths
	p.Module = path.Join("app/plugins", p.Type, currentDir, "module")
	p.BaseUrl = path.Join("public/app/plugins", p.Type, currentDir)
}

func (l *Initializer) setPathsBasedOnApp(parent *plugins.PluginV2, child *plugins.PluginV2) {
	appSubPath := strings.ReplaceAll(strings.Replace(child.PluginDir, parent.PluginDir, "", 1), "\\", "/")
	child.IncludedInAppID = parent.ID
	child.BaseUrl = parent.BaseUrl

	if isExternalPlugin(parent.PluginDir, l.Cfg) {
		child.Module = util.JoinURLFragments("plugins/"+parent.ID, appSubPath) + "/module"
	} else {
		child.Module = util.JoinURLFragments("app/plugins/app/"+parent.ID, appSubPath) + "/module"
	}
}

func getPluginLogoUrl(pluginType, path, baseUrl string) string {
	if path == "" {
		return "public/img/icn-" + pluginType + ".svg"
	}

	return evalRelativePluginUrlPath(path, baseUrl)
}

func isExternalPlugin(pluginDir string, cfg *setting.Cfg) bool {
	return !strings.Contains(pluginDir, cfg.StaticRootPath)
}

func evalRelativePluginUrlPath(pathStr string, baseUrl string) string {
	if pathStr == "" {
		return ""
	}

	u, _ := url.Parse(pathStr)
	if u.IsAbs() {
		return pathStr
	}
	return path.Join(baseUrl, pathStr)
}
