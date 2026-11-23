package live

manifest: {
	appName:       "live"
	groupOverride: "live.grafana.app"
	versions: {
		"v1alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: []
			routes: {
				namespaced: {
					// The websocket is listed here so it is documented with the other
					// routes, but the host serves it as a raw route outside the k8s
					// handler chain, because it hijacks the connection.
					"/ws": {
						"GET": {
							operationId: "connectWebsocket"
							summary:     "Open a Grafana Live websocket"
							description: "Upgrades the connection to a Grafana Live (Centrifuge) websocket for the namespace. The request must include a websocket upgrade; the requester must belong to the namespace."
							request: {}
							response: {}
							responseMetadata: typeMeta: false
						}
					}
				}
			}
		}
	}
	roles: {}
}
