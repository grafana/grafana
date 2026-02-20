package repository

manifest: {
	appName:          "provisioning"
	groupOverride:    "provisioning.grafana.app"
	preferredVersion: "v0alpha1"
	kinds: [
		repository,
		connection
	]
	roles: {}
}
