package advisor

manifest: {
	appName:       "advisor"
	groupOverride: "advisor.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: false
				backend:  true
			}
			kinds: [
				checkv0alpha1,
				checktypev0alpha1,
			]
		}
	}
}
