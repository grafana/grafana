package recordingrulejson

import "github.com/grafana/thema"

thema.#Lineage
name: "recordingrulejson"
seqs: [
	{
		schemas: [
			{
				active?:               bool
				count?:                bool
				description?:          string
				dest_data_source_uid?: string
				id?:                   string
				interval?:             int
				name?:                 string
				prom_name?:            string
				queries?: [...{
					[string]: {
						...
					}
				}]
				range?:         int
				target_ref_id?: string
			},
		]
	},
]
