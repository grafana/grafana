package dataframe

import (
	"fmt"
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
	Type ColumnType
}

func (b BaseSchema) GetName() string {
	return b.name
}

func (b BaseSchema) SetName(name string) {
	b.name = name
}

func (b BaseSchema) ColumnType() ColumnType {
	return b.Type
}

type TimeColumnSchema struct {
	BaseSchema
	Format string
}

func NewTimeColumn(format string) (t TimeColumnSchema) {
	t.Type = DateTime
	t.Format = format
	return
}

func (tcs TimeColumnSchema) ColumnType() ColumnType {
	return DateTime
}

func (tcs TimeColumnSchema) Extract(v string) (interface{}, error) {
	if v == "" {
		return nil, nil
	}
	t, err := time.Parse(tcs.Format, v)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

type NumberColumnSchema struct{ BaseSchema }

func NewNumberColumn() (t NumberColumnSchema) {
	t.Type = Number
	return
}

func (ncs NumberColumnSchema) Extract(v string) (interface{}, error) {
	if v == "" {
		return nil, nil
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return nil, err
	}
	return &f, nil

}

func NewStringColumn() (t StringColumnSchema) {
	t.Type = String
	return
}

type StringColumnSchema struct{ BaseSchema }

func (scs StringColumnSchema) Extract(v string) (interface{}, error) {
	return &v, nil

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

func (c ColumnType) String() string {
	switch c {
	case DateTime:
		return "DateTime"
	case Number:
		return "Number"
	case String:
		return "String"
	default:
		return "Other"
	}
}

func (c ColumnType) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf(`"%v"`, c.String())), nil
}
