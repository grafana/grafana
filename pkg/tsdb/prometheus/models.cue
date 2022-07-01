package prometheus

import "github.com/grafana/thema"

// TODO schemas defining prometheus query/target (composed into dashboard)
Query: thema.#Lineage & {
	seqs: [
		{
			schemas: [
				{// 0.0
					expr:           string
					legendFormat:   string
					interval:       string
					intervalMS:     int64
					stepMode:       string
					range:          bool | *true
					instant:        !range
					exemplar:       bool | *false
					intervalFactor: int64
					utcOffsetSec:   int64
				},
			]
		},
	]
}

// TODO schemas defining prometheus datasource config (composed into datasource.jsonData and datasource.secureJsonData)
DSOptions: thema.#Lineage & {
	seqs: [
		{
			schemas: [
				{// 0.0
					Options: {
						timeInterval:           string | *"15s"
						httpMethod:             "GET" | *"POST"
						queryTimeout?:          string
						directUrl?:             string
						customQueryParameters?: string
						disableMetricsLookup?:  boolean
					}
					SecureOptions: {
						basicAuthUser?:     string
						basicAuthPassword?: string
					}
				},
			]
		},
	]
}
