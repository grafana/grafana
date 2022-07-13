package testreceiverconfigresult

import "github.com/grafana/thema"

thema.#Lineage
name: "testreceiverconfigresult"
seqs: [
	{
		schemas: [
			{
				error?:  string
				name?:   string
				status?: string
				uid?:    string
			},
		]
	},
]
