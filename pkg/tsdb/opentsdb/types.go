package opentsdb

type OpenTsdbQuery struct {
	Start   int64            `json:"start"`
	End     int64            `json:"end"`
	Queries []map[string]any `json:"queries"`
}

type OpenTsdbResponse struct {
	Metric     string            `json:"metric"`
	Tags       map[string]string `json:"tags"`
	DataPoints [][]float64       `json:"dps"`
}
