package repository

_provisioningKinds: [repository, connection, job, historicJob]

manifest: {
	appName:          "provisioning"
	groupOverride:    "provisioning.grafana.app"
	preferredVersion: "v0alpha1"

	// Both versions are served from the v0alpha1 Go types, so they share one schema;
	// pkg/apis/provisioning/v1beta1 re-exports them.
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
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
