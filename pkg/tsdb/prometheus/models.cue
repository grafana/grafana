package prometheus

import "github.com/grafana/thema"

// TODO schemas defining prometheus query/target (composed into dashboard)
Query: thema.#Lineage & {
  seqs: [
    {
      schemas: [
        {// 0.0
          expr: string
          legendFormat: string
          interval: string
          intervalMS: int64
          stepMode: string
          range: bool | *true
          instant: !range
          exemplar: bool | *false
          intervalFactor: int64
          utcOffsetSec: int64
        }
      ]
    }
  ]
}

// TODO schemas defining prometheus datasource config (composed into datasource.jsonData)
Config: thema.#Lineage & {
}

// TODO schemas defining prometheus datasource secure config (composed into (?) datasource.secureJsonData)
SecureConfig: thema.#Lineage & {
}
