package kinds

manifest: {
	appName: "annotation"
  groupOverride: "annotation.grafana.app"
	versions: {
	    "v0alpha1": v0alpha1
	}
	roles: {}
}

v0alpha1: {
    kinds: [annotationv0alpha1]
    routes: {
        namespaced: {
            "/tags": {
                "GET": {
                    response: {
                        tags: [...{
                            tag: string
                            count: number
                        }]
                    }
                }
            }
        }
    }
    codegen: {
        ts: {
            enabled: true
        }
        go: {
            enabled: true
        }
    }
}
