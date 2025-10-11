package plugins

pluginInstallV0Alpha1: {
	kind: "PluginInstall"
	plural: "plugininstalls"
	scope: "Namespaced"
	schema: {
		spec: {
			pluginID: string
			version:  string
			url: string
		}
	}
}
