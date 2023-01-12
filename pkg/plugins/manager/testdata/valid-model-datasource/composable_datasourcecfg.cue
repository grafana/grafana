package grafanaplugin

composableKinds: DataSourceCfg: lineage: {
	name: "valid-model-datasource"
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
