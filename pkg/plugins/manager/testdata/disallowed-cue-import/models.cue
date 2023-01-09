package grafanaplugin

import (
	"github.com/grafana/thema"
	"github.com/grafana/grafana/kinds/dashboard:kind"
)

_dummy: coremodel.slots

Panel: thema.#Lineage & {
	name: "disallowed_cue_import"
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
