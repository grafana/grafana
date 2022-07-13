package userquotadto

import "github.com/grafana/thema"

thema.#Lineage
name: "userquotadto"
seqs: [
	{
		schemas: [
			{
				limit?:   int
				target?:  string
				used?:    int
				user_id?: int
			},
		]
	},
]
