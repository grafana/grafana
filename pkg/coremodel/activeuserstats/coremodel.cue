package activeuserstats

import "github.com/grafana/thema"

thema.#Lineage
name: "activeuserstats"
seqs: [
	{
		schemas: [
			{
				active_admins_and_editors?: int
				active_users?:              int
				active_viewers?:            int
			},
		]
	},
]
