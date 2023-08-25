package grafanaplugin

composableKinds: PanelCfg: lineage: {
	schemas: [
		{
			version: [0, 0]
			schema: {
				Options: {
					foo: string
				} @cuetsy(kind="interface")
			}
		},
	]
}
