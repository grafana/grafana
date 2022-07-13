package dashboardversiondto

import "github.com/grafana/thema"

thema.#Lineage
name: "dashboardversiondto"
seqs: [
	{
		schemas: [
			{
				created?:       string
				createdBy?:     string
				dashboardId?:   int
				dashboardUid?:  string
				id?:            int
				message?:       string
				parentVersion?: int
				restoredFrom?:  int
				version?:       int
			},
		]
	},
]
