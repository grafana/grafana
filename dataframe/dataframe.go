package dataframe

import (
	"time"
)

type FieldType int

const (
	FieldTypeTime FieldType = iota
	FieldTypeNumber
	FieldTypeString
	FieldTypeBoolean
)

type Field struct {
	Name   string
	Type   FieldType
	Vector Vector
}

func NewField(name string, fieldType FieldType, values interface{}) *Field {
	var vec Vector

	switch v := values.(type) {
	case []float64:
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.At(i).Set(v[i])
		}
	case []int64:
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.At(i).Set(v[i])
		}
	case []time.Time:
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.At(i).Set(v[i])
		}
	case []string:
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.At(i).Set(v[i])
		}
	}

	return &Field{
		Name:   name,
		Type:   fieldType,
		Vector: vec,
	}
}

func (f *Field) Len() int {
	return f.Vector.Len()
}

type Labels map[string]string

type DataFrame struct {
	Name   string
	Labels Labels
	Fields []*Field
}

func New(name string, labels Labels, fields ...*Field) *DataFrame {
	return &DataFrame{
		Name:   name,
		Labels: labels,
		Fields: fields,
	}
}

func (f *DataFrame) Rows() int {
	return f.Fields[0].Len()
}
