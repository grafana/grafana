package preferences

manifest: {
	appName:       "preferences"
	groupOverride: "preferences.grafana.app"
	versions: {
		"v1alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				preferencesv1alpha1,
			]
		}
	}
}