package secret

manifest: {
	appName:       "secret"
	groupOverride: "secret.grafana.app"
	kinds: [
		securevalue,
		keeper,
	]
}
