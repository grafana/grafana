package kinds

manifest: {
	appName:       "rules-extensions"
	groupOverride: "rules-extensions.alerting.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: true}
				go: {enabled: true}
			}
			kinds: [
				prometheusRuleFilev0alpha1,
			]
		}
	}
	roles: {}
}
