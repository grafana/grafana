// Package dataframe provides the DataFrame type.
// The DataFrame type is used to hold data returned from Grafana Datasources.
// This type is meant to tightly integrated with the DataFrame type in Grafana's Frontend.
package dataframe

import "fmt"

// DataFrame holds Table data.
type DataFrame struct {
	Schema  Schema
	Type    FrameType
	Records []Fields
}

// FrameType indicates the type of data the Dataframe holds
type FrameType int

const (
	// NumericFrame indicates the Dataframe holds numeric values.
	NumericFrame FrameType = iota

	// TimeSeriesFrame indicates the Dataframe holds timeseries data.
	TimeSeriesFrame

	// HistogramFrame indicates the Dataframe holds histograms data.
	HistogramFrame

	// OtherFrame indicates the DataFrame holds mixed or another data type.
	OtherFrame
)

func (ft FrameType) String() string {
	switch ft {
	case NumericFrame:
		return "Number"
	case TimeSeriesFrame:
		return "TimeSeries"
	case HistogramFrame:
		return "Histogram"
	default:
		return "Other"
	}
}

func (ft FrameType) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf(`"%v"`, ft.String())), nil
}

// DataFrames is a collection of DataFrames uniquely identified by key.
type DataFrames []DataFrame

// Fields is a slice fo Field.
type Fields []Field

// Field represents a unique field within a dataframe identified by its column and record position.
type Field interface{}
