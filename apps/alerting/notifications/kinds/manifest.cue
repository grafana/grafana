package alerting

manifest: {
	appName:       "alerting"
	groupOverride: "notifications.alerting.grafana.app"
	kinds: [
		receiver,
		route,
		templateGroup,
		timeInterval,
	]
}
