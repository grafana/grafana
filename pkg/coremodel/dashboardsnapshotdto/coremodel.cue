package dashboardsnapshotdto

import "github.com/grafana/thema"

thema.#Lineage
name: "dashboardsnapshotdto"
seqs: [
	{
		schemas: [
			{
				created?:     string
				expires?:     string
				external?:    bool
				externalUrl?: string
				id?:          int
				key?:         string
				name?:        string
				orgId?:       int
				updated?:     string
				userId?:      int
			},
		]
	},
]
