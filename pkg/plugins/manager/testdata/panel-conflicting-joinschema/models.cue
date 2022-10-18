package grafanaplugin

import "github.com/grafana/thema"

Panel: thema.#Lineage & {
	joinSchema: {
		PanelOptions: {...}
		PanelFieldConfig: string
	}
	name: "panel_conflicting_joinschema"
	seqs: [
		{
			schemas: [
				{
					PanelOptions: {
						foo: string
					} @cuetsy(kind="interface")
					PanelFieldConfig: string
				},
			]
		},
	]
}
