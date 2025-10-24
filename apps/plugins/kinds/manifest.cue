package plugins

manifest: {
	appName:       "plugins"
	groupOverride: "plugins.grafana.app"
	versions: {
		"v0alpha1": {
			served: true
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				pluginV0Alpha1,
			]
		}
	}
}
