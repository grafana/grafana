package prometheus

import "github.com/grafana/thema"

// TODO schemas defining prometheus query/target (composed into dashboard)
Query: thema.#Lineage & {
}

// TODO schemas defining prometheus datasource config (composed into datasource.jsonData)
Config: thema.#Lineage & {
}

// TODO schemas defining prometheus datasource secure config (composed into (?) datasource.secureJsonData)
SecureConfig: thema.#Lineage & {
}
