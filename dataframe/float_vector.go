package dataframe

import (
	"fmt"
	"time"
)

type floatVector []floatElement

func (v floatVector) At(i int) Element { return &v[i] }
func (v floatVector) Len() int         { return len(v) }

type floatElement struct {
	val float64
}

func (e *floatElement) Set(value interface{}) {
	switch val := value.(type) {
	case float64:
		e.val = val
	default:
		panic("invalid type")
	}
}

func (e *floatElement) Float() float64 {
	return e.val
}

func (e *floatElement) String() string {
	return fmt.Sprintf("%v", e.val)
}

func (e *floatElement) Time() time.Time {
	return time.Unix(0, int64(e.val)*1000)
}
