package plugins

manifest: {
	appName:       "plugins"
	groupOverride: "plugins.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				pluginMetaV0Alpha1,
				pluginInstallV0Alpha1,
			]
		}
	}
}
