package kinds

manifest: {
	appName: "annotation"
  groupOverride: "annotation.grafana.app"
	versions: {
	    "v0alpha1": v0alpha1
	}
}

v0alpha1: {
    kinds: [annotationv0alpha1]
    codegen: {
        ts: {
            enabled: true
        }
        go: {
            enabled: true
        }
    }
}
