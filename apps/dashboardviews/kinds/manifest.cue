package kinds

manifest: {
	appName:          "dashboardviews"
	groupOverride:    "dashboardviews.grafana.app"
	preferredVersion: "v0alpha1"

	codegen: {
		go: {
			enabled: true
		}
		ts: {
			enabled: true
		}
	}

	versions: {
		"v0alpha1": {
			kinds: [
				saveddashboardviewv0alpha1,
			]
		}
	}
	roles: {}
}
