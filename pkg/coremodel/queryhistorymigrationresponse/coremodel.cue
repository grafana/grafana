package queryhistorymigrationresponse

import "github.com/grafana/thema"

thema.#Lineage
name: "queryhistorymigrationresponse"
seqs: [
	{
		schemas: [
			{
				message?:      string
				starredCount?: int
				totalCount?:   int
			},
		]
	},
]
