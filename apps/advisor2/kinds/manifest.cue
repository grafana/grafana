package advisor2

manifest: {
	appName:       "advisor2"
	groupOverride: "advisor2.grafana.com"
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
