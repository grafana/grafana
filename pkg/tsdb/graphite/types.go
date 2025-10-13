package graphite

import (
	"github.com/grafana/grafana/pkg/components/null"
)

type TargetResponseDTO struct {
	Target     string               `json:"target"`
	DataPoints DataTimeSeriesPoints `json:"datapoints"`
	// Graphite <=1.1.7 may return some tags as numbers requiring extra conversion. See https://github.com/grafana/grafana/issues/37614
	Tags map[string]any `json:"tags"`
}

type DataTimePoint [2]null.Float
type DataTimeSeriesPoints []DataTimePoint
