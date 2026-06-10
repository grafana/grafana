package kinds

manifest: {
	appName:          "correlation"
	groupOverride:    "correlations.grafana.app"
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
			// Explicitly set to false to keep the app disabled by default for testing.
			served: false
			kinds: [
				correlationsv0alpha1,
			]
		}
	}
	roles: {}
}
