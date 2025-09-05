package graphite

type TargetResponseDTO struct {
	Target     string               `json:"target"`
	DataPoints DataTimeSeriesPoints `json:"datapoints"`
	// Graphite <=1.1.7 may return some tags as numbers requiring extra conversion. See https://github.com/grafana/grafana/issues/37614
	Tags map[string]any `json:"tags"`
}

type DataTimePoint [2]Float
type DataTimeSeriesPoints []DataTimePoint

type GraphiteQuery struct {
	QueryType       string   `json:"queryType"`
	TextEditor      *bool    `json:"textEditor,omitempty"`
	Target          string   `json:"target,omitempty"`
	TargetFull      string   `json:"targetFull,omitempty"`
	Tags            []string `json:"tags,omitempty"`
	FromAnnotations *bool    `json:"fromAnnotations,omitempty"`
}

type GraphiteEventsRequest struct {
	Tags  string `json:"tags,omitempty"`
	From  string `json:"from"`
	Until string `json:"until"`
}

type GraphiteEventsResponse struct {
	When int64    `json:"when"`
	What string   `json:"what"`
	Tags []string `json:"tags"`
	Data string   `json:"data"`
}

type GraphiteMetricsFindRequest struct {
	From  string `json:"from"`
	Until string `json:"until"`
	Query string `json:"query"`
}

type GraphiteMetricsFindResponse struct {
	Text          string `json:"text"`
	Id            string `json:"id"`
	AllowChildren int    `json:"allowChildren"`
	Expandable    int    `json:"expandable"`
	Leaf          int    `json:"leaf"`
}

type GraphiteMetricsExpandResponse struct {
	Results []string `json:"results"`
}
