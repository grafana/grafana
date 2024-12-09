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
					settings: {
						[string]: _
					}
					secureFields?: [string]: bool
				}
				spec: {
					title: string
					integrations : [...#Integration]
				}
			}
			selectableFields: [
				 "spec.title",
			]
		}
	}
}
