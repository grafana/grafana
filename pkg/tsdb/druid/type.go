package druid

type TimeSeriesResponse struct {
	Timestamp string             `json:"timestamp"`
	Result    map[string]float64 `json:"result"`
}

type TopNResponse struct {
	Timestamp string                   `json:"timestamp"`
	Result    []map[string]interface{} `json:"result"`
}

type GroupByResponse struct {
	Timestamp string             `json:"timestamp"`
	Event     map[string]float64 `json:"event"`
}

type SelectResponse struct {
	Timestamp string                 `json:"timestamp"`
	Result    map[string]interface{} `json:"result"`
}
