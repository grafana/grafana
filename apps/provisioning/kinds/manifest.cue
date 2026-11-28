package repository

import "github.com/grafana/grafana/apps/provisioning/v1beta2"

_provisioningKinds: [repository, connection, job, historicJob]

_manifestProperties: {
	appName:       "provisioning"
	groupOverride: "provisioning.grafana.app"
	roles: {}
}

// The only manifest code is generated from. v0alpha1 and v1beta1 are served from hand-written Go
// types, and listing them here would generate a second, conflicting set into their packages.
manifest: _manifestProperties & {
	// The API server still prefers v0alpha1; this only names the preferred version among the
	// versions listed here.
	preferredVersion: "v1beta2"
	versions: {
		"v1beta2": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [v1beta2.repository, v1beta2.connection, v1beta2.job, v1beta2.historicJob]
		}
	}
}

// The schemas of the hand-written v0alpha1 types, which also serve v1beta1. Nothing is generated
// from it. Its last generated manifest is pkg/apis/provisioning/v0alpha1/testdata/frozen-manifest.json,
// which manifest_drift_test.go compares against those types.
frozenManifest: _manifestProperties & {
	preferredVersion: "v0alpha1"
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
}
