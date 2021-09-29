package binding

import (
	"errors"
	"testing"
)

type StructWithInt struct {
	A int `binding:"Required"`
}

type StructWithPrimitives struct {
	A int     `binding:"Required"`
	B string  `binding:"Required"`
	C bool    `binding:"Required"`
	D float64 `binding:"Required"`
}

type StructWithInterface struct {
	A interface{} `binding:"Required"`
}
type StructWithSliceInts struct {
	A []int `binding:"Required"`
}
type StructWithSliceInterfaces struct {
	A []interface{} `binding:"Required"`
}
type StructWithStruct struct {
	A StructWithInt `binding:"Required"`
}
type StructWithStructPointer struct {
	A *StructWithInt `binding:"Required"`
}
type StructWithValidation struct {
	A int
}

func (sv *StructWithValidation) Validate() error {
	if sv.A < 10 {
		return errors.New("too small")
	}
	return nil
}

func TestValidationSuccess(t *testing.T) {
	for _, x := range []interface{}{
		42,
		"foo",
		struct{ A int }{},
		StructWithInt{42},
		StructWithPrimitives{42, "foo", true, 12.34},
		StructWithInterface{"foo"},
		StructWithSliceInts{[]int{1, 2, 3}},
		StructWithSliceInterfaces{[]interface{}{1, 2, 3}},
		StructWithStruct{StructWithInt{3}},
		StructWithStructPointer{&StructWithInt{3}},
		StructWithValidation{42},
	} {
		if err := validate(x); err != nil {
			t.Error("Validation failed:", x, err)
		}
	}
}
func TestValidationFailure(t *testing.T) {
	for i, x := range []interface{}{
		StructWithInt{0},
		StructWithPrimitives{0, "foo", true, 12.34},
		StructWithPrimitives{42, "", true, 12.34},
		StructWithPrimitives{42, "foo", false, 12.34},
		StructWithPrimitives{42, "foo", true, 0},
		StructWithInterface{},
		StructWithInterface{nil},
		StructWithSliceInts{},
		StructWithSliceInts{[]int{}},
		StructWithSliceInterfaces{[]interface{}{}},
		StructWithSliceInterfaces{nil},
		StructWithStruct{StructWithInt{}},
		StructWithStruct{StructWithInt{0}},
		StructWithStructPointer{},
		StructWithStructPointer{&StructWithInt{}},
		StructWithValidation{2},
	} {
		if err := validate(x); err == nil {
			t.Error("Validation should fail:", i, x)
		}
	}
}
