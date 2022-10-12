package grafanaplugin

import "github.com/grafana/thema"

Query: thema.#Lineage & {
	name: "missing_slot_impl"
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
