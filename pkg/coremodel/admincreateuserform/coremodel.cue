package admincreateuserform

import "github.com/grafana/thema"

thema.#Lineage
name: "admincreateuserform"
seqs: [
	{
		schemas: [
			{
				email?:    string
				login?:    string
				name?:     string
				orgId?:    int
				password?: string
			},
		]
	},
]
