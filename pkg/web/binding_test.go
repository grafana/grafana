package web

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

type StructWithPrivateFields struct {
	A int `binding:"Required"` // must be validated
	b int `binding:"Required"` // will not be used
}

type StructWithInterface struct {
	A interface{} `binding:"Required"`
}
type StructWithSliceInts struct {
	A []int `binding:"Required"`
}
type StructWithSliceStructs struct {
	A []StructWithInt `binding:"Required"`
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

func (sv StructWithValidation) Validate() error {
	if sv.A < 10 {
		return errors.New("too small")
	}
	return nil
}

type StructWithPointerValidation struct {
	A int
}

func (sv *StructWithPointerValidation) Validate() error {
	if sv.A < 10 {
		return errors.New("too small")
	}
	return nil
}

func TestValidationSuccess(t *testing.T) {
	var nilInterface *StructWithPointerValidation

	for _, x := range []interface{}{
		nil,
		42,
		"foo",
		struct{ A int }{},
		StructWithInt{42},
		StructWithPrimitives{42, "foo", true, 12.34},
		StructWithPrivateFields{12, 0},
		StructWithInterface{"foo"},
		StructWithSliceInts{[]int{1, 2, 3}},
		StructWithSliceInterfaces{[]interface{}{1, 2, 3}},
		StructWithSliceStructs{[]StructWithInt{{1}, {2}}},
		StructWithStruct{StructWithInt{3}},
		StructWithStructPointer{&StructWithInt{3}},
		StructWithValidation{42},
		&StructWithPointerValidation{42},
		nilInterface,
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
		StructWithPrivateFields{0, 1},
		StructWithInterface{},
		StructWithInterface{nil},
		StructWithSliceInts{},
		StructWithSliceInts{[]int{}},
		StructWithSliceStructs{[]StructWithInt{}},
		StructWithSliceStructs{[]StructWithInt{{0}, {2}}},
		StructWithSliceStructs{[]StructWithInt{{2}, {0}}},
		StructWithSliceInterfaces{[]interface{}{}},
		StructWithSliceInterfaces{nil},
		StructWithStruct{StructWithInt{}},
		StructWithStruct{StructWithInt{0}},
		StructWithStructPointer{},
		StructWithStructPointer{&StructWithInt{}},
		StructWithValidation{2},
		&StructWithPointerValidation{2},
	} {
		if err := validate(x); err == nil {
			t.Error("Validation should fail:", i, x)
		}
	}
}
