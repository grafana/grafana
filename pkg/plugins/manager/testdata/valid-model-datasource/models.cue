package grafanaplugin

import "github.com/grafana/thema"

Query: thema.#Lineage & {
	name: "valid_model_datasource"
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

DSOptions: thema.#Lineage & {
	name: "valid_model_datasource"
	seqs: [
		{
			schemas: [
				{
					Options: {
						foo: string
					}
					SecureOptions: {
						bar: string
					}
				},
			]
		},
	]
}
