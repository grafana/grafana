package prometheusremotewritetargetjson

import "github.com/grafana/thema"

thema.#Lineage
name: "prometheusremotewritetargetjson"
seqs: [
	{
		schemas: [
			{
				data_source_uid?:   string
				id?:                string
				remote_write_path?: string
			},
		]
	},
]
