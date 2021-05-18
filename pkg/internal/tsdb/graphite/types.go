package graphite

import "github.com/grafana/grafana/pkg/internal/plugins"

type TargetResponseDTO struct {
	Target     string                       `json:"target"`
	DataPoints plugins.DataTimeSeriesPoints `json:"datapoints"`
}
