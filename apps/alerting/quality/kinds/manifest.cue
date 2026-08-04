package kinds

manifest: {
	appName:       "alerting-quality"
	groupOverride: "quality.alerting.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				alertRuleQualityPolicyv0alpha1,
			]
		}
	}
	roles: {}
}
