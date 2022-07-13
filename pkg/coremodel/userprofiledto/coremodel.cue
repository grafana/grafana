package userprofiledto

import "github.com/grafana/thema"

thema.#Lineage
name: "userprofiledto"
seqs: [
	{
		schemas: [
			{
				accessControl?: [string]: bool
				authLabels?: [...string]
				avatarUrl?:      string
				createdAt?:      string
				email?:          string
				id?:             int
				isDisabled?:     bool
				isExternal?:     bool
				isGrafanaAdmin?: bool
				login?:          string
				name?:           string
				orgId?:          int
				theme?:          string
				updatedAt?:      string
			},
		]
	},
]
