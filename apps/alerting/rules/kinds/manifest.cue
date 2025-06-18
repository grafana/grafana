package kinds

manifest: {
	appName:       "alerting"
	groupOverride: "rules.alerting.grafana.app"
	kinds: [
		alertRule,
		recordingRule,
	]
}
