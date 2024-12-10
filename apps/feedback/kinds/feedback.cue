package core

manifest: {
	appName:       "feedback"
	groupOverride: "feedback.grafana.app"
	kinds: [feedbackKind]
}

feedbackKind: {
	kind: "Feedback"
	mutation: operations: ["create", "update"]
	validation: operations: ["create", "update"]
	codegen: {
		frontend: true
		backend:  true
	}
	current: "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				spec: {
					message:           string
					screenshot?:       bytes
					imageType?:        string
					screenshotUrl?:    string
					githubIssueUrl?:   string
					reporterEmail?:    string
					canAccessInstance: bool
					diagnosticData?: {...}
				}
			}
		}
	}
}
