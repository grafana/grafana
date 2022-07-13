package massdeleteannotationscmd

import "github.com/grafana/thema"

thema.#Lineage
name: "massdeleteannotationscmd"
seqs: [
	{
		schemas: [
			{
				annotationId?: int
				dashboardId?:  int
				dashboardUID?: string
				panelId?:      int
			},
		]
	},
]
