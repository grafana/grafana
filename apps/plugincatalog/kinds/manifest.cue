package plugincatalog

manifest: {
	appName:       "plugincatalog"
	groupOverride: "plugincatalog.grafana.app"
	versions: {
		"v0alpha1": v0alpha1Version
	}
}

v0alpha1Version: {
	served: true
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
	kinds: [
		pluginV0Alpha1,
	]
}
