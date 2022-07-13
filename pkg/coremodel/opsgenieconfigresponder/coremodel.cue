package opsgenieconfigresponder

import "github.com/grafana/thema"

thema.#Lineage
name: "opsgenieconfigresponder"
seqs: [
	{
		schemas: [
			{
				// One of those 3 should be filled.
				id?:   string
				name?: string

				// team, user, escalation, schedule etc.
				type?:     string
				username?: string
			},
		]
	},
]
