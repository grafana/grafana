package notifications

notificationv0alpha1: {
	kind:       "Notification"
	plural:     "notifications"
	scope:      "Namespaced"
	conversion: false
	validation: {
		operations: ["CREATE", "UPDATE"]
	}
	schema: {
		spec: {
			recipientUID: string
			orgID:        int64
			type:         "mention" | "reply"
			createdAt:    string // RFC3339

			source: {
				kind:         "comment"
				commentUID:   string
				threadUID:    string
				dashboardUID: string
				deepLink:     string
			}

			actor: {
				uid:   string
				login: string
				name:  string
			}

			excerpt: string // bounded at 280 chars by producer
		}
		status: {
			read:    bool
			readAt?: string // RFC3339
		}
	}
}
