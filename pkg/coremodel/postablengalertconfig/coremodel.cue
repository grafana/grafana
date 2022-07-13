package postablengalertconfig

import "github.com/grafana/thema"

thema.#Lineage
name: "postablengalertconfig"
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
