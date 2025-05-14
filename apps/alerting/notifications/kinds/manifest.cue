package kinds

manifest: {
	appName:       "alerting"
	groupOverride: "notifications.alerting.grafana.app"
	kinds: [
		receiver,
		routeTree,
		templateGroup,
		timeInterval,
	]
}
