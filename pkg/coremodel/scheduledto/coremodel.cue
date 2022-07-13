package scheduledto

import "github.com/grafana/thema"

thema.#Lineage
name: "scheduledto"
seqs: [
	{
		schemas: [
			{
				day?:               string
				dayOfMonth?:        string
				endDate?:           string
				frequency?:         string
				hour?:              int
				intervalAmount?:    int
				intervalFrequency?: string
				minute?:            int
				startDate?:         string
				timeZone?:          string
				workdaysOnly?:      bool
			},
		]
	},
]
