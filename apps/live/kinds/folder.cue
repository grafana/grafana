package live

liveV1beta1: {
	kind:       "Channel"
	pluralName: "Channels"

  schema: {
		spec: {
			title:    string
			description?: string
		}
	}
}