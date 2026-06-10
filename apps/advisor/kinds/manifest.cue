package advisor

manifest: {
	appName:       "advisor"
	groupOverride: "advisor.grafana.app"
	versions: {
		"v0alpha1": {
     	// Explicitly set to false to keep the app disabled by default for testing.
     	served: false
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				checkv0alpha1,
				checktypev0alpha1,
			]
			routes: {
				namespaced: {
					"/register": {
						"POST": {
							name: "createRegister"
							response: {
								message: string
							}
						}
					}
				}
			}
		}
	}
	roles: {}
}
