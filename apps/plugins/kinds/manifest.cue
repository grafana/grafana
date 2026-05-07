package plugins

manifest: {
	appName:       "plugins"
	groupOverride: "plugins.grafana.app"
	versions: {
		"v0alpha1": v0alpha1Version
	}
	roles: {}
}

v0alpha1Version: {
	served: true
	codegen: {
		ts: {enabled: true}
		go: {enabled: true}
	}
	kinds: [
		pluginV0Alpha1,
		metaV0Alpha1,
	]
}
