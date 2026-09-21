package v1beta1

ReceiverSpec: {
	title: string
	integrations: [...#Integration]
}

// Fields every integration carries. `variant` is the discriminator: codegen needs a
// single field whose value differs between every branch, and neither type nor version
// does that on its own. It is derived from the two, so it cannot drift from them.
#Common: {
	uid?:                   string
	disableResolveMessage?: bool
	type:                   string
	version:                string
	variant?:               "\(type)/\(version)"
}

#EmailV1: {
	#Common
	type:    "email"
	version: "v1"
	settings: {
		addresses:    string
		singleEmail?: bool
		message?:     string
		subject?:     string
	}
}

#EmailMimir1: {
	#Common
	type:    "email"
	version: "v0mimir1"
	settings: {
		to?:        string
		from?:      string
		smarthost?: string
		html?:      string
	}
}

#SlackV1: {
	#Common
	type:    "slack"
	version: "v1"
	settings: {
		endpointUrl?:    string
		recipient?:      string
		text?:           string
		title?:          string
		username?:       string
		mentionChannel?: string
	}
	secureFields?: {
		token?: bool
		url?:   bool
	}
}

#SlackMimir1: {
	#Common
	type:    "slack"
	version: "v0mimir1"
	settings: {
		channel?:  string
		color?:    string
		fallback?: string
	}
}

#WebhookV1: {
	#Common
	type:    "webhook"
	version: "v1"
	settings: {
		url:         string
		httpMethod?: string
		maxAlerts?:  int
	}
	secureFields?: [string]: bool
}

#Integration: #EmailV1 | #EmailMimir1 | #SlackV1 | #SlackMimir1 | #WebhookV1

// The test route takes one integration in its request body, and codegen does not allow
// a union there, so the route keeps the flat shape.
#IntegrationInput: {
	uid?:                   string
	type:                   string
	version:                string
	disableResolveMessage?: bool
	settings: {
		[string]: _
	}
	secureFields?: [string]: bool
}
