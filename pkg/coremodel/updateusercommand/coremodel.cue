package updateusercommand

import "github.com/grafana/thema"

thema.#Lineage
name: "updateusercommand"
seqs: [
	{
		schemas: [
			{
				email?: string
				login?: string
				name?:  string
				theme?: string
			},
		]
	},
]
