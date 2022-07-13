package versioninfo

import "github.com/grafana/thema"

thema.#Lineage
name: "versioninfo"
seqs: [
	{
		schemas: [
			{
				// branch
				branch: string

				// build date
				buildDate: string

				// build user
				buildUser: string

				// go version
				goVersion: string

				// revision
				revision: string

				// version
				version: string
			},
		]
	},
]
