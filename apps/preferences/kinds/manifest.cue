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
				preferencesV1alpha1,
				starsV1alpha1,
			]
		}
	}
}