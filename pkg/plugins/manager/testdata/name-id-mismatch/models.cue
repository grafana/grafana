package grafanaplugin

import "github.com/grafana/thema"

composableKinds: PanelCfg: lineage: {
	name: "mismatch"
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
