package investigations

manifest: {
	appName:       "investigations"
	groupOverride: "investigations.grafana.app"
	kinds: [
		investigation,
		investigationIndex,
	]
}
