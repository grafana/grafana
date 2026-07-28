package kinds

manifest: {
	appName:       "annotation"
	groupOverride: "annotation.grafana.app"
	versions: {
		"v0alpha1": v0alpha1
	}
	roles: {}
}

v0alpha1: {
	kinds: [annotationv0alpha1]
	routes: {
		namespaced: {
			"/tags": {
				"GET": {
					name: "getTags"
					response: {
						tags: [...{
							tag:   string
							count: number
						}]
					}
				}
			}
			"/search": {
				"GET": {
					name: "getSearch"
					response: {
						apiVersion: string
						kind:       string
						items: [...]
					}
				}
			}
			"/graphite": {
				"POST": {
					name: "createGraphite"
					request: {
						body: {
							what:  string
							when?: int64
							data?: string
							// tags accepts either an array of strings or a single space-separated string
							tags: string | [...string]
						}
					}
					response: {
						spec: {...}
					}
					responseMetadata: objectMeta: true
				}
			}
		}
	}
	codegen: {
		ts: {
			enabled: true
		}
		go: {
			enabled: true
		}
	}
}
