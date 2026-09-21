package kinds

manifest: {
	appName:       "errortracking"
	groupOverride: "error-tracking.grafana.app"

	versions: {
		"v0alpha1": v0alpha1
	}

	extraPermissions: {
		accessKinds: []
	}

	roles: {}
}

// v0alpha1 has no managed kinds of its own — this app doesn't use unified storage.
// It carries the custom /events routes below, backed by the app's own
// SQL table instead.
v0alpha1: {
	kinds: []

	// Kept disabled by default. Enable locally via custom.ini:
	//   [grafana-apiserver]
	//   runtime_config = error-tracking.grafana.app/v0alpha1=true
	served: false

	routes: {
		namespaced: {
			"/events": {
				"POST": {
					name: "createEvent"
					authz: {resource: "events", verb: "create"}
					request: {body: {project: string, message: string, occurredAt?: int64}}
					response: {status: string}
				}
				"GET": {
					name: "listEvents"
					authz: {resource: "events", verb: "list"}
					request: {query: {from?: string, to?: string, limit?: string}}
					response: {items: [...{occurredAt: int64, project: string, message: string, createdBy: string}]}
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
