package graphite

import "github.com/grafana/grafana/pkg/plugins"

type TargetResponseDTO struct {
	Target     string                       `json:"target"`
	DataPoints plugins.DataTimeSeriesPoints `json:"datapoints"`
	Tags       map[string]string            `json:"tags"`
}
