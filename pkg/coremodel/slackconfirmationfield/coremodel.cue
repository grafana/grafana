package slackconfirmationfield

import "github.com/grafana/thema"

thema.#Lineage
name: "slackconfirmationfield"
seqs: [
	{
		schemas: [
			{
				dismiss_text?: string
				ok_text?:      string
				text?:         string
				title?:        string
			},
		]
	},
]
