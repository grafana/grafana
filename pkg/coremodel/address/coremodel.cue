package address

import "github.com/grafana/thema"

thema.#Lineage
name: "address"
seqs: [
	{
		schemas: [
			{
				address1?: string
				address2?: string
				city?:     string
				country?:  string
				state?:    string
				zipCode?:  string
			},
		]
	},
]
