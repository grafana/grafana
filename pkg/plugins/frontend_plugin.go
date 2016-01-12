package plugins

import (
	"net/url"
	"path"
	"path/filepath"
)

type FrontendPluginBase struct {
	PluginBase
	Module     string `json:"module"`
	StaticRoot string `json:"staticRoot"`
}

func (fp *FrontendPluginBase) initFrontendPlugin() {
	if fp.StaticRoot != "" {
		StaticRoutes = append(StaticRoutes, &PluginStaticRoute{
			Directory: filepath.Join(fp.PluginDir, fp.StaticRoot),
			PluginId:  fp.Id,
		})
	}

	fp.Info.Logos.Small = evalRelativePluginUrlPath(fp.Info.Logos.Small, fp.Id)
	fp.Info.Logos.Large = evalRelativePluginUrlPath(fp.Info.Logos.Large, fp.Id)

	fp.handleModuleDefaults()
}

func (fp *FrontendPluginBase) handleModuleDefaults() {
	if fp.Module != "" {
		return
	}

	if fp.StaticRoot != "" {
		fp.Module = path.Join("plugins", fp.Id, "module")
		return
	}

	fp.Module = path.Join("app/plugins", fp.Type, fp.Id, "module")
}

func evalRelativePluginUrlPath(pathStr string, pluginId string) string {
	u, _ := url.Parse(pathStr)
	if u.IsAbs() {
		return pathStr
	}
	return path.Join("public/plugins", pluginId, pathStr)
}
