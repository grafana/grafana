package pausealertcommand

import "github.com/grafana/thema"

thema.#Lineage
name: "pausealertcommand"
seqs: [
	{
		schemas: [
			{
				alertId?: int
				paused?:  bool
			},
		]
	},
]
