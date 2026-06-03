package notifications

manifest: {
	appName:       "notifications"
	groupOverride: "notifications.grafana.app"
	versions: {
		"v0alpha1": {
			storage: true
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				notificationv0alpha1,
			]
		}
	}
	roles: {}
}
