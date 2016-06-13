package transformer

import (
	"fmt"
	"math"

	"github.com/grafana/grafana/pkg/tsdb"
)

func NewAggregationTransformer(method string) *AggregationTransformer {
	return &AggregationTransformer{
		Method: method,
	}
}

type AggregationTransformer struct {
	Method string
}

func (at *AggregationTransformer) Transform(timeserie *tsdb.TimeSeries) (float64, error) {

	if at.Method == "avg" {
		sum := float64(0)
		for _, point := range timeserie.Points {
			sum += point[0]
		}

		return sum / float64(len(timeserie.Points)), nil
	}

	if at.Method == "sum" {
		sum := float64(0)

		for _, v := range timeserie.Points {
			sum += v[0]
		}

		return sum, nil
	}

	if at.Method == "min" {
		min := timeserie.Points[0][0]

		for _, v := range timeserie.Points {
			if v[0] < min {
				min = v[0]
			}
		}

		return min, nil
	}

	if at.Method == "max" {
		max := timeserie.Points[0][0]

		for _, v := range timeserie.Points {
			if v[0] > max {
				max = v[0]
			}
		}

		return max, nil
	}

	if at.Method == "mean" {
		midPosition := int64(math.Floor(float64(len(timeserie.Points)) / float64(2)))
		return timeserie.Points[midPosition][0], nil
	}

	return float64(0), fmt.Errorf("Missing method")
}
