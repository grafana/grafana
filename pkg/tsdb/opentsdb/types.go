package opentsdb

type OpenTsdbQuery struct {
	Start	   int64     				 `json:"start"`
	End		   int64   	 				 `json:"end"`
	Queries  []OpenTsdbMetric  `json:"queries"`
}

type OpenTsdbMetric struct {
	Metric      string  `json:"metric"`
	Aggregator  string  `json:"aggregator"`
}

type OpenTsdbResponse struct {
  Metric     string              `json:"metric"`
  DataPoints map[string]float64  `json:"dps"`
}