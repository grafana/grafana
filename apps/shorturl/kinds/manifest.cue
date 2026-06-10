package kinds

manifest: {
	appName:       "shorturl"
	groupOverride: "shorturl.grafana.app"
	versions: {
		"v1beta1": {
			// Explicitly set to false to keep the app disabled by default for testing.
			served: false
			kinds: [shorturl]
		}
	}
	roles: {}
}
