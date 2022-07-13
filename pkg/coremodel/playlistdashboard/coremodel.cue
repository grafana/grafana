package playlistdashboard

import "github.com/grafana/thema"

thema.#Lineage
name: "playlistdashboard"
seqs: [
	{
		schemas: [
			{
				id?:    int
				order?: int
				slug?:  string
				title?: string
				uri?:   string
				url?:   string
			},
		]
	},
]
