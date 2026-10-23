package kinds

manifest: {
	appName:          "alerting"
	groupOverride:    "rules.alerting.grafana.app"
	preferredVersion: "v1beta1"
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
				configv0alpha1,
			]
			routes: searchRoutes
		}
		// Config and the rule search routes stay v0alpha1-only for now.
		"v1beta1": {
			codegen: {
				ts: {enabled: true}
				go: {enabled: true}
			}
			kinds: [
				alertRulev1beta1,
				recordingRulev1beta1,
				ruleSequencev1beta1,
			]
		}
	}
	roles: {}
}
