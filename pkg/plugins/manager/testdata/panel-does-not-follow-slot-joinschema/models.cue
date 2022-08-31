package grafanaplugin

import "github.com/grafana/thema"

Panel: thema.#Lineage & {
	name: "panel_does_not_follow_slot_joinschema"
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
