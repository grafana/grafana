package alertnotificationlookup

import "github.com/grafana/thema"

thema.#Lineage
name: "alertnotificationlookup"
seqs: [
	{
		schemas: [
			{
				id?:        int
				isDefault?: bool
				name?:      string
				type?:      string
				uid?:       string
			},
		]
	},
]
