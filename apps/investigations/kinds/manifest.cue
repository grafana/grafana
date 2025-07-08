package investigations

manifest: {
	appName:       "investigations"
	groupOverride: "investigations.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: true
				backend:  true
				options: {
					generateObjectMeta: true
					generateClient:     true
					k8sLike:            true
					package:            "github.com/grafana/grafana/apps/investigations"
				}
			}
			kinds: [
				investigationv0alpha1,
				investigationIndexv0alpha1,
			]
		}
	}
}
