package live

channelV1alpha1: {
	kind:       "Channel"
	pluralName: "Channels"

	// Channels are not stored in unified storage, so a search would always come
	// back empty.
	search: {
		endpoint: false
	}

	schema: {
		spec: {
			// The Channel path
			path: string

			// The message count in the last min
			minute_rate: int

			// DataFrame schema
			data: [string]: _
		}
	}
}
