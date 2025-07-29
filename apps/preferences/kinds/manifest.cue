package preferences

manifest: {
	appName:       "preferences"
	groupOverride: "preferences.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				preferencesv0alpha1,
			]
		}
	}
}