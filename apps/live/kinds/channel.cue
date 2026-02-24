package live

channelV1alpha1: {
	kind:       "Channel"
	pluralName: "Channels"

  schema: {
		spec: {
			// The Channel path
			path: string

			// The message count in the last min
			minute_rate:    int

			// DataFrame schema
			data: [string]: _
		}
	}
}