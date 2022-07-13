package userlookupdto

import "github.com/grafana/thema"

thema.#Lineage
name: "userlookupdto"
seqs: [
	{
		schemas: [
			{
				avatarUrl?: string
				login?:     string
				userId?:    int
			},
		]
	},
]
