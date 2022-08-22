package grafanaplugin

import "github.com/grafana/thema"

Panel: thema.#Lineage & {
	name: "panel_models_valid"
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
