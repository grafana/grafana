package repository

manifest: {
	appName:          "provisioning"
	groupOverride:    "provisioning.grafana.app"
	preferredVersion: "v0alpha1"
	versions: {
		"v0alpha1": {
			served: true
			kinds: [repository, connection, job, historicjob]
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
		}
		// v1beta1 serves the same Go types as v0alpha1.
		"v1beta1": {
			served: true
			kinds: [repositoryV1beta1, connectionV1beta1, jobV1beta1, historicjobV1beta1]
			codegen: {
				ts: {enabled: false}
				go: {enabled: false}
			}
		}
	}
	roles: {}
}

repositoryV1beta1:  repository
connectionV1beta1:  connection
jobV1beta1:         job
historicjobV1beta1: historicjob
