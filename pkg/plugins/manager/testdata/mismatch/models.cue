package grafanaplugin

import "github.com/grafana/thema"

Panel: thema.#Lineage & {
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
