package kinds

manifest: {
	appName:       "dashboard"
	groupOverride: "dashboard.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {
					enabled: true
					config: {
						enumsAsUnionTypes: true
					}
				}
				go: {
					enabled: true
					config: {
						allowMarshalEmptyDisjunctions: true
					}
				}
			}
			kinds: [
				dashboardv0alpha1,
			]
		}
		"v1beta1": {
			codegen: {
				ts: {
					enabled: true
					config: {
						enumsAsUnionTypes: true
					}
				}
				go: {
					enabled: true
					config: {
						allowMarshalEmptyDisjunctions: true
					}
				}
			}
			kinds: [
				dashboardv1beta1,
			]
		}
		"v2alpha1": {
			codegen: {
				ts: {
					enabled: true
					config: {
						enumsAsUnionTypes: true
					}
				}
				go: {
					enabled: true
					config: {
						allowMarshalEmptyDisjunctions: true
					}
				}
			}
			kinds: [
				dashboardv2alpha1,
			]
		}
	}
}
