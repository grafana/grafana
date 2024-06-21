package core

receiver: {
	kind:  "Receiver"
	group: "notifications"
	apiResource: {
		groupOverride: "notifications.alerting.grafana.app"
	}
	codegen: {
		frontend: false
		backend:  true
	}
	pluralName: "Receivers"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				#Integration: {
					uid?: string
					type: string
					disableResolveMessage?: bool
					settings: bytes
				}
				spec: {
					title: string
					integrations : [...#Integration]
				}
			}
		}
	}
}
