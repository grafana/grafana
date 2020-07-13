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

func (fp *FrontendPluginBase) initFrontendPlugin() {
	if isExternalPlugin(fp.PluginDir) {
		StaticRoutes = append(StaticRoutes, &PluginStaticRoute{
			Directory: fp.PluginDir,
			PluginId:  fp.Id,
		})
	}

	fp.handleModuleDefaults()

	fp.Info.Logos.Small = getPluginLogoUrl(fp.Type, fp.Info.Logos.Small, fp.BaseUrl)
	fp.Info.Logos.Large = getPluginLogoUrl(fp.Type, fp.Info.Logos.Large, fp.BaseUrl)

	for i := 0; i < len(fp.Info.Screenshots); i++ {
		fp.Info.Screenshots[i].Path = evalRelativePluginUrlPath(fp.Info.Screenshots[i].Path, fp.BaseUrl)
	}
}

func getPluginLogoUrl(pluginType, path, baseUrl string) string {
	if path == "" {
		return "public/img/icn-" + pluginType + ".svg"
	}

	return evalRelativePluginUrlPath(path, baseUrl)
}

func (fp *FrontendPluginBase) setPathsBasedOnApp(app *AppPlugin) {
	appSubPath := strings.Replace(strings.Replace(fp.PluginDir, app.PluginDir, "", 1), "\\", "/", -1)
	fp.IncludedInAppId = app.Id
	fp.BaseUrl = app.BaseUrl

	if isExternalPlugin(app.PluginDir) {
		fp.Module = util.JoinURLFragments("plugins/"+app.Id, appSubPath) + "/module"
	} else {
		fp.Module = util.JoinURLFragments("app/plugins/app/"+app.Id, appSubPath) + "/module"
	}
}

func (fp *FrontendPluginBase) handleModuleDefaults() {
	if isExternalPlugin(fp.PluginDir) {
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

func isExternalPlugin(pluginDir string) bool {
	return !strings.Contains(pluginDir, setting.StaticRootPath)
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
