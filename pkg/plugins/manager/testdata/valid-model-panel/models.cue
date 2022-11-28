package grafanaplugin

import "github.com/grafana/thema"

Panel: thema.#Lineage & {
	name: "valid_model_panel"
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
