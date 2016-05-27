package models

import "math"

type TimeSeries struct {
	Name   string       `json:"name"`
	Points [][2]float64 `json:"points"`

	Avg  float64
	Sum  float64
	Min  float64
	Max  float64
	Mean float64
}

type TimeSeriesSlice []*TimeSeries

func NewTimeSeries(name string, points [][2]float64) *TimeSeries {
	ts := &TimeSeries{
		Name:   name,
		Points: points,
	}

	ts.Min = points[0][0]
	ts.Max = points[0][0]

	for _, v := range points {
		value := v[0]

		if value > ts.Max {
			ts.Max = value
		}

		if value < ts.Min {
			ts.Min = value
		}

		ts.Sum += value
	}

	ts.Avg = ts.Sum / float64(len(points))
	midPosition := int64(math.Floor(float64(len(points)) / float64(2)))

	ts.Mean = points[midPosition][0]

	return ts
}
