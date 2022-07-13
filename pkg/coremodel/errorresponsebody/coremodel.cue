package errorresponsebody

import "github.com/grafana/thema"

thema.#Lineage
name: "errorresponsebody"
seqs: [
	{
		schemas: [
			{
				// Error An optional detailed description of the actual error.
				// Only included if running in developer mode.
				error?: string

				// a human readable version of the error
				message: string

				// Status An optional status to denote the cause of the error.
				//
				// For example, a 412 Precondition Failed error may include
				// additional information of why that error happened.
				status?: string
			},
		]
	},
]
