package dataframe

import (
	"fmt"
	"strconv"
	"time"
)

type stringVector []stringElement

func (v stringVector) Set(i int, val interface{}) {
	v[i].Set(val)
}
func (v stringVector) At(i int) Element { return &v[i] }
func (v stringVector) Len() int         { return len(v) }

type stringElement struct {
	val string
}

func (e *stringElement) Set(value interface{}) {
	switch v := value.(type) {
	case string:
		e.val = v
	default:
		e.val = fmt.Sprintf("%v", v)
	}
}

func (e *stringElement) Bool() bool {
	v, _ := strconv.ParseBool(e.val)
	return v
}

func (e *stringElement) Float() float64 {
	v, _ := strconv.ParseFloat(e.val, 64)
	return v
}

func (e *stringElement) String() string {
	return e.val
}

func (e *stringElement) Time() time.Time {
	t, _ := time.Parse(time.RFC3339, e.val)
	return t
}
