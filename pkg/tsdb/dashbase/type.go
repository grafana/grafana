package dashbase

import "github.com/grafana/grafana/pkg/tsdb"

type DashbaseResponsePoint struct {
  Target     string                `json:"target"`
  DataPoints tsdb.TimeSeriesPoints `json:"datapoints"`
}
