package updateorgaddressform

import "github.com/grafana/thema"

thema.#Lineage
name: "updateorgaddressform"
seqs: [
	{
		schemas: [
			{
				address1?: string
				address2?: string
				city?:     string
				country?:  string
				state?:    string
				zipcode?:  string
			},
		]
	},
]
