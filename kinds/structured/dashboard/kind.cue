package dashboard

import "github.com/grafana/grafana/pkg/framework/kind"

kind.#CoreStructured

maturity: "committed" // generated dashboard types aren't yet in use in frontend, so it's at "committed" maturity

lineage: name: "dashboard"
lineage: seqs: [
	{
		schemas: [
			{// 0.0

				// dashboard schema goes here, same as in pkg/coremodel/dashboard/coremodel.cue.
				// omitting it so this illustrative prototyping has fewer lines to look at
			}]
	}]
