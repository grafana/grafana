package kinds

shorturl: {
	kind:		"ShortURL"
	pluralName:	"ShortURLs"
	// validation hooks are not working now there is a bug in the sdk v0.40.2
  validation: operations: ["CREATE"]
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
