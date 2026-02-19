package kinds

manifest: {
	appName:       "alerting"
	groupOverride: "rules.alerting.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: true}
				go: {enabled: true}
			}
			kinds: [
				alertRulev0alpha1,
				recordingRulev0alpha1,
			]
		}
	}
}
