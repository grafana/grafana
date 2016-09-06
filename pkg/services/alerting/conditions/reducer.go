package conditions

import "github.com/grafana/grafana/pkg/tsdb"

type QueryReducer interface {
	Reduce(timeSeries *tsdb.TimeSeries) *float64
}

type SimpleReducer struct {
	Type string
}

func (s *SimpleReducer) Reduce(series *tsdb.TimeSeries) *float64 {
	if len(series.Points) == 0 {
		return nil
	}

	var value float64 = 0

	switch s.Type {
	case "avg":
		for _, point := range series.Points {
			value += point[0]
		}
		value = value / float64(len(series.Points))
	case "sum":
		for _, point := range series.Points {
			value += point[0]
		}
	case "min":
		for i, point := range series.Points {
			if i == 0 {
				value = point[0]
			}

			if value > point[0] {
				value = point[0]
			}
		}
	case "max":
		for _, point := range series.Points {
			if value < point[0] {
				value = point[0]
			}
		}
	case "mean":
		meanPosition := int64(len(series.Points) / 2)
		value = series.Points[meanPosition][0]
	case "count":
		value = float64(len(series.Points))
	}

	return &value
}

func NewSimpleReducer(typ string) *SimpleReducer {
	return &SimpleReducer{Type: typ}
}
