package kinds

shorturl: {
	kind:		"ShortURL"
	pluralName:	"ShortURLs"
	group:      "shorturl.grafana.app"
	current:	"v1alpha1"
	schema: {
		spec: {
			path: string
			uid: string
			lastSeenAt: int64
			shortURL: string
		}
	}
}
