package orguserdto

import "github.com/grafana/thema"

thema.#Lineage
name: "orguserdto"
seqs: [
	{
		schemas: [
			{
				accessControl?: [string]: bool
				avatarUrl?:     string
				email?:         string
				lastSeenAt?:    string
				lastSeenAtAge?: string
				login?:         string
				name?:          string
				orgId?:         int
				role?:          string
				userId?:        int
			},
		]
	},
]
