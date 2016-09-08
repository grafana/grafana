package conditions

import (
	"math"

	"github.com/grafana/grafana/pkg/tsdb"
)

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

	value := float64(0)
	allNull := true

	switch s.Type {
	case "avg":
		for _, point := range series.Points {
			if point[0] != nil {
				value += *point[0]
				allNull = false
			}
		}
		value = value / float64(len(series.Points))
	case "sum":
		for _, point := range series.Points {
			if point[0] != nil {
				value += *point[0]
				allNull = false
			}
		}
	case "min":
		value = math.MaxFloat64
		for _, point := range series.Points {
			if point[0] != nil {
				allNull = false
				if value > *point[0] {
					value = *point[0]
				}
			}
		}
	case "max":
		value = -math.MaxFloat64
		for _, point := range series.Points {
			if point[0] != nil {
				allNull = false
				if value < *point[0] {
					value = *point[0]
				}
			}
		}
	case "count":
		value = float64(len(series.Points))
		allNull = false
	}

	if allNull {
		return nil
	}

	return &value
}

func NewSimpleReducer(typ string) *SimpleReducer {
	return &SimpleReducer{Type: typ}
}
