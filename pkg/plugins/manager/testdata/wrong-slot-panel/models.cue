package grafanaplugin

import "github.com/grafana/thema"

Query: thema.#Lineage & {
	name: "wrong_slot_panel"
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

Panel: thema.#Lineage & {
	name: "wrong_slot_panel"
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
