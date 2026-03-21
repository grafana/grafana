package kinds

manifest: {
	appName:       "queryhistory"
	groupOverride: "queryhistory.grafana.app"
	versions: {
		"v0alpha1": {
			kinds: [queryhistory]
		}
	}
	roles: {}
}
