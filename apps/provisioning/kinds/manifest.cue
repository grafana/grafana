package repository

manifest: {
	appName:          "provisioning"
	groupOverride:    "provisioning.grafana.app"
	versions: {
		"v0alpha1": v0alpha1Version
	}
}

v0alpha1Version: {
	served: true
	kinds: [
		repository,
		connection
	]
}
