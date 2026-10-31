package preferences

manifest: {
	appName:          "preferences"
	groupOverride:    "preferences.grafana.app"
	preferredVersion: "v1"
	versions: {
		"v1": {
			storage:           true
			importOpenAPIFile: "preferences-v1.openapi.json"
			codegen: {
				ts: {enabled: false}
				go: {enabled: true} // v1 is the generated version
			}
			kinds: [
				preferencesV1,
			]
		}
		"v1alpha1": {
			importOpenAPIFile: "preferences-v1alpha1.openapi.json"
			codegen: {
				ts: {enabled: false}
				go: {enabled: false} // v1alpha1 is now a thin wrapper around v1
			}
			kinds: [
				preferencesV1alpha1,
			]
		}
	}
	// preferences/merged lists the caller's preferences. An anonymous caller has no
	// identity to list as, so the app lists as itself, and sees what any identity
	// that is not a user sees: the namespace's preferences.
	extraPermissions: {
		accessKinds: [
			{
				group:    "preferences.grafana.app"
				resource: "preferences"
				actions: ["get"]
			},
		]
	}
	roles: {}
}
