package advisor

manifest: {
	appName:       "advisor"
	groupOverride: "advisor.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				checkv0alpha1,
                checktypev0alpha1,
			]
		}
	}
}
