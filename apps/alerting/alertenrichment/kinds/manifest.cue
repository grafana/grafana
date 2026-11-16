package kinds

manifest: {
	appName:          "alertenrichment"
	groupOverride:    "alertenrichment.grafana.app"
	preferredVersion: "v1beta1"
	versions: {
		"v1beta1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				alertEnrichmentv1beta1,
			]
		}
	}
	roles: {}
}
