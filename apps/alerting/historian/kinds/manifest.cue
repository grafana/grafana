package kinds

manifest: {
	appName:       "alerting-historian"
	groupOverride: "historian.alerting.grafana.app"
	versions: {
		"v0alpha1": v0alpha1
	}
}

v0alpha1: {
    kinds: [dummyv0alpha1]

    routes: {
        namespaced: {
            // This endpoint is an exact copy of the existing /history endpoint,
            // with the exception that error responses will be Kubernetes-style,
            // not Grafana-style. It will be replaced in the future with a better
            // more schema-friendly API.
            "/alertstate/history": {
                "GET": {
                    response: {
                      body: [string]: _
                    }
                    responseMetadata: typeMeta: false
                }
            }
        }
    }
}

dummyv0alpha1: {
    kind: "Dummy"
    schema: {
        // Spec is the schema of our resource. The spec should include all the user-editable information for the kind.
        spec: {
            dummyField: int
        }
    }
}