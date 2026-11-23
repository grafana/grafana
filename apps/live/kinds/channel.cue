package live

// Channel is a read-only view of the Live channels that are active in a
// namespace. Channels are not stored: the host serves get and list from its
// Live node, and create, update and delete are not supported.
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
			// The channel path, for example stream/telegraf/cpu
			path: string
		}
		status: {
			// The message count in the last minute
			minute_rate: int

			// DataFrame schema of the last message
			data: [string]: _
		}
	}
}
