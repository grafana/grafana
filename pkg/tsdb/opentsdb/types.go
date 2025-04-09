package opentsdb

type OpenTsdbQuery struct {
	Start   int64            `json:"start"`
	End     int64            `json:"end"`
	Queries []map[string]any `json:"queries"`
}

type OpenTsdbCommon struct {
	Metric string            `json:"metric"`
	Tags   map[string]string `json:"tags"`
}

type OpenTsdbResponse struct {
	OpenTsdbCommon
	DataPoints map[string]float64 `json:"dps"`
}

type OpenTsdbResponse24 struct {
	OpenTsdbCommon
	DataPoints [][]float64 `json:"dps"`
}
