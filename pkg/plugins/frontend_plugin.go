package plugins

import (
	"net/url"
	"path"
	"path/filepath"
)

type FrontendPluginBase struct {
	PluginBase
	Module        string `json:"module"`
	BaseUrl       string `json:"baseUrl"`
	StaticRoot    string `json:"staticRoot"`
	StaticRootAbs string `json:"-"`
}

func (fp *FrontendPluginBase) initFrontendPlugin() {
	if fp.StaticRoot != "" {
		fp.StaticRootAbs = filepath.Join(fp.PluginDir, fp.StaticRoot)
		StaticRoutes = append(StaticRoutes, &PluginStaticRoute{
			Directory: fp.StaticRootAbs,
			PluginId:  fp.Id,
		})
	}

	fp.Info.Logos.Small = evalRelativePluginUrlPath(fp.Info.Logos.Small, fp.Id)
	fp.Info.Logos.Large = evalRelativePluginUrlPath(fp.Info.Logos.Large, fp.Id)
	for i := -0; i < len(fp.Info.Screenshots); i++ {
		fp.Info.Screenshots[i].Path = evalRelativePluginUrlPath(fp.Info.Screenshots[i].Path, fp.Id)
	}
	fp.handleModuleDefaults()
}

func (fp *FrontendPluginBase) handleModuleDefaults() {
	if fp.Module != "" {
		return
	}

	if fp.StaticRoot != "" {
		fp.Module = path.Join("plugins", fp.Id, "module")
		fp.BaseUrl = path.Join("public/plugins", fp.Id)
		return
	}

	fp.Module = path.Join("app/plugins", fp.Type, fp.Id, "module")
	fp.BaseUrl = path.Join("public/app/plugins", fp.Type, fp.Id)
}

func evalRelativePluginUrlPath(pathStr string, pluginId string) string {
	u, _ := url.Parse(pathStr)
	if u.IsAbs() {
		return pathStr
	}
	return path.Join("public/plugins", pluginId, pathStr)
}
