package grafanaplugin

composableKinds: PanelCfg: lineage: {
	schemas: [
		{
			version: [0, 0]
			schema: {
				PanelOptions: {
					foo: string
				} @cuetsy(kind="interface")
			}
		},
	]
}
