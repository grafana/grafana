package kinds

shorturl: {
	kind:		"ShortURL"
	pluralName:	"ShortURLs"
	current:	"v0alpha1"
	apiResource: {
		groupOverride: "shorturl.grafana.app"
	}
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: true
				backend:  true
			}
			schema: {
				spec: {
					path: string
					lastSeenAt: int64
				}
			}
		}
	}
}
