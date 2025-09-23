package grafanaplugin

composableKinds: PanelCfg: lineage: {
	name: "doesnamatch"
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
