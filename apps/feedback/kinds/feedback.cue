package core

externalName: {
	kind:  "Feedback"
	group: "feedback"
	apiResource: {
		groupOverride: "feedback.grafana.app"
		mutation: operations: ["create", "update"]
		validation: operations: ["create", "update"]
	}
	codegen: {
		frontend: true
		backend:  true
	}
	current: "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				spec: {
					message:        string
					screenshot?:    bytes
					imageType?:     string
					screenshotUrl?: string
					diagnosticData?: {...}
				}
			}
		}
	}
}
