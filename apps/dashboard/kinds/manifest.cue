package kinds

manifest: {
	appName:          "dashboard"
	groupOverride:    "dashboard.grafana.app"
	preferredVersion: "v1beta1"

	codegen: {
		go: {
			enabled: true
		}

		ts: {
			enabled: false
			config: {
				enumsAsUnionTypes: true
			}
		}
	}

	versions: {
		"v0alpha1": {
			kinds: [dashboardv0alpha1]
		}
		"v1beta1": {
			kinds: [dashboardv1beta1]
		}
		"v2alpha1": {
			kinds: [dashboardv2alpha1]
		}
		"v2beta1": {
			kinds: [dashboardv2beta1]
		}
	}
}
