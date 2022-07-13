package annotationactions

import "github.com/grafana/thema"

thema.#Lineage
name: "annotationactions"
seqs: [
	{
		schemas: [
			{
				canAdd?:    bool
				canDelete?: bool
				canEdit?:   bool
			},
		]
	},
]
