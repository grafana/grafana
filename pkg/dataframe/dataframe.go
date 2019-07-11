// Package dataframe provides the DataFrame type.
// The DataFrame type is used to hold data returned from Grafana Datasources.
// This type is meant to tightly integrated with the DataFrame type in Grafana's Frontend.
package dataframe

import (
	"strconv"
	"time"
)

// DataFrame holds Table data.
type DataFrame struct {
	Columns Columns
	Records []Fields
	Type    FrameType
}

// FrameType indicates the type of data the Dataframe holds
type FrameType int

// Columns is a slice of Column.
type Columns []Column

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

// DataFrames is a collection of DataFrames uniquely identified by key.
type DataFrames []DataFrame

// ColumnType is the type of Data that a DataFrame column holds.
type ColumnType int

// ColumnTypes is a slice of ColumnType

const (
	// DateTime is the ColumnType holds a value that is a representation of absolute time.
	DateTime ColumnType = iota

	// Number is the ColumnType that indicates the column will have integers and floats.
	Number

	// String is the ColumnType that indicate the column will have string values.
	String

	// Bool is the ColumnType that indicates the column will have a boolean values.
	Bool

	// Other is the ColumnType that indicates the column has an unknown type or mix of value types.
	Other
)

// The Column interface represents a column within a DataFrame.
type Column struct {
	Name         string     // Name is the type of the column.
	Type         ColumnType // ColumnType is the type of data that the column holds.
	Unit         UnitType   // Unit is metadata about the unit of the data that the column holds.
	OriginalType string     // Information only
	// IsIndex or IsUniqueIndex maybe?
}

// Fields is a slice fo Field.
type Fields []Field

// Field represents a unique field within a dataframe identified by its column and record position.
type Field struct {
	Value interface{}
}

type ColumnSpecifiers []ColumnSpecifer

type ColumnSpecifer interface {
	ColumnType() ColumnType
	Extract(v string) (interface{}, error)
}

type TimeColumnSpecifier struct {
	Format string
}

func (tcs TimeColumnSpecifier) ColumnType() ColumnType {
	return DateTime
}

func (tcs TimeColumnSpecifier) Extract(v string) (interface{}, error) {
	return time.Parse(tcs.Format, v)
}

type NumberColumnSpecifier struct{}

func (ncs NumberColumnSpecifier) ColumnType() ColumnType {
	return Number
}

func (ncs NumberColumnSpecifier) Extract(v string) (interface{}, error) {
	return strconv.ParseFloat(v, 64)
}
