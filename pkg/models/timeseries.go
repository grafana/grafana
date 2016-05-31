package models

type TimeSeries struct {
	Name   string       `json:"name"`
	Points [][2]float64 `json:"points"`
}

type TimeSeriesSlice []*TimeSeries

func NewTimeSeries(name string, points [][2]float64) *TimeSeries {
	return &TimeSeries{
		Name:   name,
		Points: points,
	}
}
