package permission

import "github.com/grafana/thema"

thema.#Lineage
name: "permission"
seqs: [
	{
		schemas: [
			{
				action?:  string
				created?: string
				scope?:   string
				updated?: string
			},
		]
	},
]
