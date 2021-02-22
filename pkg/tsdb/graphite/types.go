package graphite

import "github.com/grafana/grafana/pkg/plugins/models"

type TargetResponseDTO struct {
	Target     string                      `json:"target"`
	DataPoints models.TSDBTimeSeriesPoints `json:"datapoints"`
}
