package core

template: {
	kind:  "Template"
	group: "notifications"
	apiResource: {
		groupOverride: "notifications.alerting.grafana.app"
	}
	codegen: {
		frontend: false
		backend:  true
	}
	pluralName: "Templates"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				spec: {
					template: string
				}
			}
		}
	}
}
