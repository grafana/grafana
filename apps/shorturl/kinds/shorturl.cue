package kinds

shorturl: {
	kind:		"ShortURL"
	pluralName:	"ShortURLs"
	schema: {
		spec: {
			// The original path to where the short url is linking too e.g. https://localhost:3000/eer8i1kictngga/new-dashboard-with-lib-panel
			path: string

			// The random string that is used as part of the generated short URL. e.g. l356YhwHg
			uid: string

			// The last time the short URL was used, 0 is the initial value
			lastSeenAt: int64

			// The actual short URL that is generated e.g. https://localhost:3000/goto/l356YhwHg?orgId=1
			shortURL: string
		}
	}
}
