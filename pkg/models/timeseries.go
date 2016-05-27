package models

type TimeSeries struct {
	Name   string       `json:"name"`
	Points [][2]float64 `json:"points"`
}

type TimeSeriesSlice []*TimeSeries
