package gettablengalertconfig

import "github.com/grafana/thema"

thema.#Lineage
name: "gettablengalertconfig"
seqs: [
	{
		schemas: [
			{
				alertmanagers?: [...string]
				alertmanagersChoice?: "all" | "internal" | "external"
			},
		]
	},
]
