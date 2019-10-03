package dataframe

import "time"

type timeVector []timeElement

func (v timeVector) Set(i int, val interface{}) {
	v[i].Set(val)
}
func (v timeVector) At(i int) Element { return &v[i] }
func (v timeVector) Len() int         { return len(v) }

type timeElement struct {
	val time.Time
}

func (e *timeElement) Set(value interface{}) {
	switch v := value.(type) {
	case time.Time:
		e.val = v
	case int64:
		e.val = time.Unix(0, v*1000)
	default:
		panic("invalid type")
	}
}

func (e *timeElement) Bool() bool {
	return !e.val.IsZero()
}

func (e *timeElement) Float() float64 {
	return float64(e.val.UnixNano()) / 1000.0
}

func (e *timeElement) String() string {
	return e.val.String()
}

func (e *timeElement) Time() time.Time {
	return e.val
}
