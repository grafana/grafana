package preferences

manifest: {
	appName:          "preferences"
	groupOverride:    "preferences.grafana.app"
	preferredVersion: "v1"
	versions: {
		"v1": {
			storage: true
			codegen: {
				ts: {enabled: false}
				go: {enabled: true} // v1 is the generated version
			}
			kinds: [
				preferencesV1,
			]
		}
		"v1alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: false} // v1alpha1 is now a thin wrapper around v1
			}
			kinds: [
				preferencesV1alpha1,
			]
		}
	}
	roles: {}
}
