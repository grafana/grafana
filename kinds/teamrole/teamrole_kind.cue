package kind

import "time"

name:        "TeamRole"
maturity:    "merged"
description: "An association between a Team and a Role"

lineage: seqs: [
	{
		schemas: [
			// v0.0
			{
				// Namespace aka tenant/org id.
				namespace: string

				// Unique role uid.
				roleUid: string

				// Unique team name
				teamName: string

				// Created indicates when the team role was created.
				created: string & time.Time
			},
		]
	},
]
