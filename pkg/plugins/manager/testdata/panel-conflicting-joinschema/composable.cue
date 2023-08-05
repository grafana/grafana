package grafanaplugin

import "github.com/grafana/thema"

composableKinds: PanelCfg: {
	lineage: {
		joinSchema: {
			Options: {...}
			FieldConfig: string
		}
		name: "panel_conflicting_joinschema"
		seqs: [
			{
				schemas: [
					{
						Options: {
							foo: string
						} @cuetsy(kind="interface")
						FieldConfig: string
					},
				]
			},
		]
	}
}
