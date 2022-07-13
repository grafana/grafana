package playlist

import "github.com/grafana/thema"

thema.#Lineage
name: "playlist"
seqs: [
	{
		schemas: [
			{
				id?:       int
				interval?: string
				name?:     string
				uid?:      string
			},
		]
	},
]
