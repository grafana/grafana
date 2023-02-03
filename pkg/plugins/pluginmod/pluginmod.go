package pluginmod

var pluginSvc PluginManager

func GetPluginsService() PluginManager {
	return pluginSvc
}

func RegisterPluginsService(p PluginManager) {
	pluginSvc = p
}
