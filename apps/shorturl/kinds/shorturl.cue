package kinds

shorturl: {
	kind:		"ShortURL"
	pluralName:	"ShortURLs"
	schema: {
		spec: {
			path: string
			uid: string
			lastSeenAt: int64
			shortURL: string
		}
	}
}
