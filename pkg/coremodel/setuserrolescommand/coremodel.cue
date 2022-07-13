package setuserrolescommand

import "github.com/grafana/thema"

thema.#Lineage
name: "setuserrolescommand"
seqs: [
	{
		schemas: [
			{
				global?:        bool
				includeHidden?: bool
				roleUids?: [...string]
			},
		]
	},
]
