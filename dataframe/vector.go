package dataframe

import "time"

type Vector interface {
	At(i int) Element
	Len() int
}

type Element interface {
	Set(val interface{})

	Bool() bool
	Float() float64
	String() string
	Time() time.Time
}

func newVector(t FieldType, n int) Vector {
	switch t {
	case FieldTypeNumber:
		return make(floatVector, n)
	case FieldTypeTime:
		return make(timeVector, n)
	case FieldTypeString:
		return make(stringVector, n)
	case FieldTypeBoolean:
		return make(boolVector, n)
	default:
		return nil
	}
}
