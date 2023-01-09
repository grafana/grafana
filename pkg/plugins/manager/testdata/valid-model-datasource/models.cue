package grafanaplugin

import "github.com/grafana/thema"

composableKinds: Queries: lineage: {
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

composableKinds: DatasourceCfg: lineage: {
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
