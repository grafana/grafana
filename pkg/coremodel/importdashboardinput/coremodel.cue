package importdashboardinput

import "github.com/grafana/thema"

thema.#Lineage
name: "importdashboardinput"
seqs: [
	{
		schemas: [
			{
				name?:     string
				pluginId?: string
				type?:     string
				value?:    string
			},
		]
	},
]
