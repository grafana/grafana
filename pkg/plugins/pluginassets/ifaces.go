package pluginassets

import "github.com/grafana/grafana/pkg/plugins"

type Provider interface {
	Module(plugin PluginInfo) (string, error)
	AssetPath(plugin PluginInfo, assetPath ...string) (string, error)
}

type PluginInfo struct {
	JsonData plugins.JSONData
	Class    plugins.Class
	FS       plugins.FS
	Parent   *PluginInfo
}

func NewPluginInfo(jsonData plugins.JSONData, class plugins.Class, fs plugins.FS, parent *PluginInfo) PluginInfo {
	return PluginInfo{
		JsonData: jsonData,
		Class:    class,
		FS:       fs,
		Parent:   parent,
	}
}
