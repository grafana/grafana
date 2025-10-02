package kinds

manifest: {
	appName:          "history"
	groupOverride:    "history.grafana.app"
	preferredVersion: "v0alpha1"

	codegen: {
		go: {
			enabled: true
		}
		ts: {
			enabled: false
		}
	}

	versions: {
		"v0alpha1": {
			kinds: [
				queryV0alpha1,
			]
		}
	}
}