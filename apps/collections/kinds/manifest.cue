package preferences

manifest: {
	appName:       "collections"
	groupOverride: "collections.grafana.app"
	versions: {
		"v1alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				starsV1alpha1,
			]
		}
	}
	roles: {}
}