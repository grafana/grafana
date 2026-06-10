package kinds

manifest: {
	// Explicitly set to false to keep the app disabled by default for testing.
	served: false
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
				ruleSequencev0alpha1,
			]
		}
	}
	roles: {}
}
