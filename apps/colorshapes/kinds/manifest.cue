package kinds

manifest: {
	appName:       "colorshapes"
	groupOverride: "colorshapes.grafana.app"

	versions: {
		"v0alpha1": v0alpha1
	}

	extraPermissions: {
		accessKinds: []
	}

	roles: {}
}

// v0alpha1 has no managed kinds of its own — this app doesn't use unified storage.
// It only exists to carry the custom /hits routes below, which are backed by the
// app's own SQL table instead.
v0alpha1: {
	kinds: []

	// Kept disabled by default. Enable locally via custom.ini:
	//   [grafana-apiserver]
	//   runtime_config = colorshapes.grafana.app/v0alpha1=true
	served: false

	routes: {
		namespaced: {
			"/hits": {
				"POST": {
					name: "createHit"
					request: {
						body: {
							color: string
							shape: string
						}
					}
					response: {
						status: string
					}
				}
				"GET": {
					name: "listHits"
					request: {
						query: {
							from?: string
							to?:   string
						}
					}
					response: {
						items: [...{
							createdAt: int64
							sourceIp:  string
							color:     string
							shape:     string
							createdBy: string
						}]
					}
				}
			}
			"/events": {
				"GET": {
					name: "listEvents"
					request: { query: { from?: string, to?: string } }
					response: { items: [...{ eventId: string, projectId: string, message: string, occurredAt: int64 }] }
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
