package repository

_provisioningKinds: [repository, connection, job, historicJob]

manifest: {
	appName:          "provisioning"
	groupOverride:    "provisioning.grafana.app"
	preferredVersion: "v0alpha1"

	// Both versions are served from the same hand-written Go types in
	// pkg/apis/provisioning/v0alpha1, so they share one schema.
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: false}
			}
			kinds: _provisioningKinds
		}
		"v1beta1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: false}
			}
			kinds: _provisioningKinds
		}
	}
	roles: {}
}
