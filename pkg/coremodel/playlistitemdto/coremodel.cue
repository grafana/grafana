package playlistitemdto

import "github.com/grafana/thema"

thema.#Lineage
name: "playlistitemdto"
seqs: [
	{
		schemas: [
			{
				id?:         int
				order?:      int
				playlistid?: int
				title?:      string
				type?:       string
				value?:      string
			},
		]
	},
]
