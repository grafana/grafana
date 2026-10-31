package preferences

manifest: {
	appName:       "collections"
	groupOverride: "collections.grafana.app"
	versions: {
		"v1alpha1": {
			// The update routes, with the parameter details the old API server published.
			importOpenAPIFile: "stars-v1alpha1.openapi.json"
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
