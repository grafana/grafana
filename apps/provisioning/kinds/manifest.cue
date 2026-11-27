package repository

import "github.com/grafana/grafana/apps/provisioning/v1beta2"

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
		// Generated Go types with renamed fields and types. Defined in kinds/v1beta2 so the
		// schemas above stay frozen. Not served yet.
		"v1beta2": {
			served: false
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [v1beta2.repository, v1beta2.connection, v1beta2.job, v1beta2.historicJob]
		}
	}
	roles: {}
}
