package dataframe

import (
	"fmt"
	"time"
)

type boolVector []stringElement

func (v boolVector) At(i int) Element { return &v[i] }
func (v boolVector) Len() int         { return len(v) }

type boolElement struct {
	val bool
}

func (e *boolElement) Set(value interface{}) {
	switch v := value.(type) {
	case bool:
		e.val = v
	default:
		e.val = false
	}
}

func (e *boolElement) Bool() bool {
	return e.val
}

func (e *boolElement) Float() float64 {
	if e.val {
		return 1.0
	}
	return 0.0
}

func (e *boolElement) String() string {
	return fmt.Sprintf("%v", e.val)
}

func (e *boolElement) Time() time.Time {
	return time.Time{}
}
