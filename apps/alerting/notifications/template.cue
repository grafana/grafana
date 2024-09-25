package core

templateGroup: {
	kind:  "TemplateGroup"
	group: "notifications"
	apiResource: {
		groupOverride: "notifications.alerting.grafana.app"
	}
	codegen: {
		frontend: false
		backend:  true
	}
	pluralName: "TemplatesGroups"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				spec: {
					title: string
					content: string
				}
			}
		}
	}
}
