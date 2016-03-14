package plugins

import (
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/setting"
)

type FrontendPluginBase struct {
	PluginBase
}

func (fp *FrontendPluginBase) initFrontendPlugin() {
	if !isExternalPlugin(fp.PluginDir) {
		fp.StaticRootAbs = fp.PluginDir
		StaticRoutes = append(StaticRoutes, &PluginStaticRoute{
			Directory: fp.StaticRootAbs,
			PluginId:  fp.Id,
		})
	}

	fp.handleModuleDefaults()

	fp.Info.Logos.Small = evalRelativePluginUrlPath(fp.Info.Logos.Small, fp.BaseUrl)
	fp.Info.Logos.Large = evalRelativePluginUrlPath(fp.Info.Logos.Large, fp.BaseUrl)

	for i := 0; i < len(fp.Info.Screenshots); i++ {
		fp.Info.Screenshots[i].Path = evalRelativePluginUrlPath(fp.Info.Screenshots[i].Path, fp.BaseUrl)
	}
}

func (fp *FrontendPluginBase) setPathsBasedOnApp(app *AppPlugin) {
	appSubPath := strings.Replace(fp.PluginDir, app.StaticRootAbs, "", 1)
	fp.IncludedInAppId = app.Id
	fp.BaseUrl = app.BaseUrl
	fp.Module = util.JoinUrlFragments("plugins/"+app.Id, appSubPath) + "/module"
}

func (fp *FrontendPluginBase) handleModuleDefaults() {

	if isExternalPlugin(fp.PluginDir) {
		fp.Module = path.Join("plugins", fp.Id, "module")
		fp.BaseUrl = path.Join("public/plugins", fp.Id)
		return
	}

	fp.Module = path.Join("app/plugins", fp.Type, fp.Id, "module")
	fp.BaseUrl = path.Join("public/app/plugins", fp.Type, fp.Id)
}

func isExternalPlugin(pluginDir string) bool {
	return strings.Contains(pluginDir, setting.StaticRootPath)
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
