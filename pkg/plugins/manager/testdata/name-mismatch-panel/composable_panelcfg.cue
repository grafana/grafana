package grafanaplugin

composableKinds: PanelCfg: lineage: {
	name: "doesnamatch"
	seqs: [
		{
			schemas: [
				{
					PanelOptions: {
						foo: string
					} @cuetsy(kind="interface")
				},
			]
		},
	]
}
