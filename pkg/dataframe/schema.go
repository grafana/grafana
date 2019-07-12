package dataframe

import (
	"strconv"
	"time"
)

// Schema is a slice of ColumnSchema.
type Schema []ColumnSchema

type ColumnSchema interface {
	GetName() string
	SetName(name string)
	ColumnType() ColumnType
	Extract(v string) (interface{}, error)
}

type BaseSchema struct {
	name string
}

func (b BaseSchema) GetName() string {
	return b.name
}

func (b BaseSchema) SetName(name string) {
	b.name = name
}

type TimeColumnSchema struct {
	BaseSchema
	Format string
}

func (tcs TimeColumnSchema) ColumnType() ColumnType {
	return DateTime
}

func (tcs TimeColumnSchema) Extract(v string) (interface{}, error) {
	return time.Parse(tcs.Format, v)
}

type NumberColumnSchema struct{ BaseSchema }

func (ncs NumberColumnSchema) ColumnType() ColumnType {
	return Number
}

func (ncs NumberColumnSchema) Extract(v string) (interface{}, error) {
	return strconv.ParseFloat(v, 64)
}

// ColumnType is the type of Data that a DataFrame column holds.
type ColumnType int

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
