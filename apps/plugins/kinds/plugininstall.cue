package plugins

pluginInstallV0Alpha1: {
	kind: "PluginInstall"
	plural: "plugininstalls"
	scope: "Namespaced"
	schema: {
	spec: {
		id:       string
		version:  string
		url?: string
		class: "core" | "external" | "cdn"
	}
	}
}
