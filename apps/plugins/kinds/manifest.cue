package plugins

manifest: {
	appName:       "plugins"
	groupOverride: "plugins.grafana.app"
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
	routes: {
		namespaced: {
			"/metas": {
				"GET": {
					response: {
						items: [...{
							id:   string
							type: string
							name: string
						}]
					}
					responseMetadata: {
						typeMeta:   false
						objectMeta: false
					}
				}
			}
		}
	}
}
