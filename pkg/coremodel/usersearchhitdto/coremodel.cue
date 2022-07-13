package usersearchhitdto

import "github.com/grafana/thema"

thema.#Lineage
name: "usersearchhitdto"
seqs: [
	{
		schemas: [
			{
				authLabels?: [...string]
				avatarUrl?:     string
				email?:         string
				id?:            int
				isAdmin?:       bool
				isDisabled?:    bool
				lastSeenAt?:    string
				lastSeenAtAge?: string
				login?:         string
				name?:          string
			},
		]
	},
]
