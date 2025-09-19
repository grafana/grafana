package kinds

manifest: {
	appName:       "alerting"
	groupOverride: "notifications.alerting.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: true}
				go: {enabled: true}
			}
			kinds: [
				receiverv0alpha1,
				routeTreev0alpha1,
				templatev0alpha1,
				timeIntervalv0alpha1,
			]
		}
	}
}
