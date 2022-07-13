package dashboardreportdto

import "github.com/grafana/thema"

thema.#Lineage
name: "dashboardreportdto"
seqs: [
	{
		schemas: [
			{
				id?:   int
				name?: string
				uid?:  string
			},
		]
	},
]
