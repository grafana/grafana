package reportemaildto

import "github.com/grafana/thema"

thema.#Lineage
name: "reportemaildto"
seqs: [
	{
		schemas: [
			{
				email?: string

				// Comma-separated list of emails to which to send the report to.
				emails?: string

				// Send the report to the emails specified in the report. Required
				// if emails is not present.
				id?: string

				// Send the report to the emails specified in the report. Required
				// if emails is not present.
				useEmailsFromReport?: bool
			},
		]
	},
]
