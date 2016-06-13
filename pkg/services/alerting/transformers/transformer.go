package transformers

import "github.com/grafana/grafana/pkg/tsdb"

type Transformer interface {
	Transform(timeserie *tsdb.TimeSeries) (float64, error)
}
