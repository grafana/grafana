package web

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
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
	A any `binding:"Required"`
}
type StructWithSliceInts struct {
	A []int `binding:"Required"`
}
type StructWithSliceStructs struct {
	A []StructWithInt `binding:"Required"`
}
type StructWithSliceInterfaces struct {
	A []any `binding:"Required"`
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

type BindTarget struct {
	Message string `json:"message"`
}

// Used to verify that Bind does not try to allocate the whole body on the heap
type endlessReader struct {
	prefix []byte
	read   int64
}

func (r *endlessReader) Read(p []byte) (int, error) {
	if len(r.prefix) > 0 {
		n := copy(p, r.prefix)
		r.prefix = r.prefix[n:]
		r.read += int64(n)
		return n, nil
	}
	for i := range p {
		p[i] = 'A'
	}
	r.read += int64(len(p))
	return len(p), nil
}

func TestBindRejectsOversizedBody(t *testing.T) {
	body := &endlessReader{prefix: []byte(`{"message":"`)}
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set("Content-Type", "application/json")

	var target BindTarget
	err := Bind(req, &target)
	if err == nil {
		t.Fatal("expected Bind to reject oversized body, got nil error")
	}

	if body.read > MaxBindBodyBytes+(1<<20) {
		t.Fatalf("Bind read %d bytes, want at most ~%d", body.read, MaxBindBodyBytes)
	}
}

func TestBindAcceptsBodyWithinLimit(t *testing.T) {
	payload := `{"message":"` + strings.Repeat("A", 1024) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")

	var target BindTarget
	if err := Bind(req, &target); err != nil && !errors.Is(err, io.EOF) {
		t.Fatalf("Bind failed on small body: %v", err)
	}
	if len(target.Message) != 1024 {
		t.Fatalf("unexpected message length: got %d, want 1024", len(target.Message))
	}
}

func TestValidationSuccess(t *testing.T) {
	var nilInterface *StructWithPointerValidation

	for _, x := range []any{
		nil,
		42,
		"foo",
		struct{ A int }{},
		StructWithInt{42},
		StructWithPrimitives{42, "foo", true, 12.34},
		StructWithPrivateFields{12, 0},
		StructWithInterface{"foo"},
		StructWithSliceInts{[]int{1, 2, 3}},
		StructWithSliceInterfaces{[]any{1, 2, 3}},
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
	for i, x := range []any{
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
		StructWithSliceInterfaces{[]any{}},
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
