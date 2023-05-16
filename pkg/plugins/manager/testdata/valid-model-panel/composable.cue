package grafanaplugin

composableKinds: PanelCfg: lineage: {
	seqs: [
		{
			schemas: [
				{
					Options: {
						foo: string
					} @cuetsy(kind="interface")
				},
			]
		},
	]
}
