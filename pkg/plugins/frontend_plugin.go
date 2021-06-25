package plugins

import (
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type FrontendPluginBase struct {
	PluginBase
}

func (fp *FrontendPluginBase) InitFrontendPlugin(cfg *setting.Cfg) []*PluginStaticRoute {
	var staticRoutes []*PluginStaticRoute
	if isExternalPlugin(fp.PluginDir, cfg) {
		staticRoutes = []*PluginStaticRoute{
			{
				Directory: fp.PluginDir,
				PluginId:  fp.Id,
			},
		}
	}

	fp.handleModuleDefaults(cfg)

	fp.Info.Logos.Small = getPluginLogoUrl(fp.Type, fp.Info.Logos.Small, fp.BaseUrl)
	fp.Info.Logos.Large = getPluginLogoUrl(fp.Type, fp.Info.Logos.Large, fp.BaseUrl)

	for i := 0; i < len(fp.Info.Screenshots); i++ {
		fp.Info.Screenshots[i].Path = evalRelativePluginUrlPath(fp.Info.Screenshots[i].Path, fp.BaseUrl, fp.Type)
	}

	return staticRoutes
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

func (fp *FrontendPluginBase) setPathsBasedOnApp(app *AppPlugin, cfg *setting.Cfg) {
	appSubPath := strings.ReplaceAll(strings.Replace(fp.PluginDir, app.PluginDir, "", 1), "\\", "/")
	fp.IncludedInAppId = app.Id
	fp.BaseUrl = app.BaseUrl

	if isExternalPlugin(app.PluginDir, cfg) {
		fp.Module = util.JoinURLFragments("plugins/"+app.Id, appSubPath) + "/module"
	} else {
		fp.Module = util.JoinURLFragments("app/plugins/app/"+app.Id, appSubPath) + "/module"
	}
}

func (fp *FrontendPluginBase) handleModuleDefaults(cfg *setting.Cfg) {
	if isExternalPlugin(fp.PluginDir, cfg) {
		fp.Module = path.Join("plugins", fp.Id, "module")
		fp.BaseUrl = path.Join("public/plugins", fp.Id)
		return
	}

	fp.IsCorePlugin = true
	// Previously there was an assumption that the plugin directory
	// should be public/app/plugins/<plugin type>/<plugin id>
	// However this can be an issue if the plugin directory should be renamed to something else
	currentDir := filepath.Base(fp.PluginDir)
	// use path package for the following statements
	// because these are not file paths
	fp.Module = path.Join("app/plugins", fp.Type, currentDir, "module")
	fp.BaseUrl = path.Join("public/app/plugins", fp.Type, currentDir)
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
