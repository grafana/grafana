package kinds

manifest: {
	appName:          "correlations"
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
			kinds: [
				correlationsv0alpha1,
			]
		}
	}
}