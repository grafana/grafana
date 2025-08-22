package kinds

shorturl: {
	kind:		"ShortURL"
	pluralName:	"ShortURLs"
  validation: operations: ["CREATE","UPDATE"]
	schema: {
		spec: {
			// The original path to where the short url is linking too e.g. https://localhost:3000/eer8i1kictngga/new-dashboard-with-lib-panel
			path: string
		}
		status: {
			// The last time the short URL was used, 0 is the initial value
			lastSeenAt: int64
		}
	}
}
