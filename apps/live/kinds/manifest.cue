package live

manifest: {
	appName:       "live"
	groupOverride: "live.grafana.app"
	versions: {
		"v1alpha1": {
     	// Explicitly set to false to keep the app disabled by default for testing.
     	served: false
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				channelV1alpha1,
			]
			routes: {
				// namespaced contains namespace-scoped resource routes for the version,
				// which are exposed as HTTP handlers on '<version>/namespaces/<namespace>/<route>'.
				namespaced: {
					"/something": {
						"GET": {
							name: "getSomething"
							response: {
								namespace: string
								message:   string
							}
							request: {
								query: {
									message?: string
								}
							}
						}
					}
				}
			}
		}
	}
	roles: {}
}
