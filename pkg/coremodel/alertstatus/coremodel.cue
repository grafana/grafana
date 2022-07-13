package alertstatus

import "github.com/grafana/thema"

thema.#Lineage
name: "alertstatus"
seqs: [
	{
		schemas: [
			{
				// inhibited by
				inhibitedBy: [...string]

				// silenced by
				silencedBy: [...string]

				// state
				state: "[unprocessed active suppressed]"
			},
		]
	},
]
