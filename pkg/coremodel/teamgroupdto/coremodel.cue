package teamgroupdto

import "github.com/grafana/thema"

thema.#Lineage
name: "teamgroupdto"
seqs: [
	{
		schemas: [
			{
				groupId?: string
				orgId?:   int
				teamId?:  int
			},
		]
	},
]
