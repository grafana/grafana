package grafanaplugin

import "github.com/grafana/thema"

Query: thema.#Lineage & {
	name: "datasource_models_valid"
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
	name: "datasource_models_valid"
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
