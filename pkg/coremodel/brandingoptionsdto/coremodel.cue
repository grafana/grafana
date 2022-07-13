package brandingoptionsdto

import "github.com/grafana/thema"

thema.#Lineage
name: "brandingoptionsdto"
seqs: [
	{
		schemas: [
			{
				emailFooterLink?: string
				emailFooterMode?: string
				emailFooterText?: string
				emailLogoUrl?:    string
				reportLogoUrl?:   string
			},
		]
	},
]
