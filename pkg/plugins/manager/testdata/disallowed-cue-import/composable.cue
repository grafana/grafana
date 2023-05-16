package grafanaplugin

import (
	"github.com/grafana/thema"
	"github.com/grafana/grafana/kinds/dashboard:kind"
)

_dummy: coremodel.slots

composableKinds: PanelCfg: {
	lineage: {
		name: "disallowed_cue_import"
		seqs: [
			{
				schemas: [
					{
						Options: {
							foo: string
						} @cuetsy(kind="interface")
					},
				]
			},
		]
	}
}
