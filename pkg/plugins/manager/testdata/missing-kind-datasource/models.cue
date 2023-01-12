package grafanaplugin

import "github.com/grafana/thema"

Query: thema.#Lineage & {
	name: "missing_kind_datasource"
	seqs: [
		{
			schemas: [
				{
					foo: string
				},
			]
		},
	]
}
