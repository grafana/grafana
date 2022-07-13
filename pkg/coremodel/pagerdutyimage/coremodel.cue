package pagerdutyimage

import "github.com/grafana/thema"

thema.#Lineage
name: "pagerdutyimage"
seqs: [
	{
		schemas: [
			{
				alt?:  string
				href?: string
				src?:  string
			},
		]
	},
]
