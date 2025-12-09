package investigations

manifest: {
	appName:       "investigations"
	groupOverride: "investigations.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				investigationV0alpha1,
				investigationIndexV0alpha1,
			]
		}
	}
}