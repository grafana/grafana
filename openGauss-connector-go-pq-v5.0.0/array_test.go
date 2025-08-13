package pq

import (
	"bytes"
	"database/sql"
	"database/sql/driver"
	"math/rand"
	"reflect"
	"strings"
	"testing"
)

func TestParseArray(t *testing.T) {
	for _, tt := range []struct {
		input string
		delim string
		dims  []int
		elems [][]byte
	}{
		{`{}`, `,`, nil, [][]byte{}},
		{`{NULL}`, `,`, []int{1}, [][]byte{nil}},
		{`{a}`, `,`, []int{1}, [][]byte{{'a'}}},
		{`{a,b}`, `,`, []int{2}, [][]byte{{'a'}, {'b'}}},
		{`{{a,b}}`, `,`, []int{1, 2}, [][]byte{{'a'}, {'b'}}},
		{`{{a},{b}}`, `,`, []int{2, 1}, [][]byte{{'a'}, {'b'}}},
		{
			`{{{a,b},{c,d},{e,f}}}`, `,`, []int{1, 3, 2}, [][]byte{
				{'a'}, {'b'}, {'c'}, {'d'}, {'e'}, {'f'},
			},
		},
		{`{""}`, `,`, []int{1}, [][]byte{{}}},
		{`{","}`, `,`, []int{1}, [][]byte{{','}}},
		{`{",",","}`, `,`, []int{2}, [][]byte{{','}, {','}}},
		{`{{",",","}}`, `,`, []int{1, 2}, [][]byte{{','}, {','}}},
		{`{{","},{","}}`, `,`, []int{2, 1}, [][]byte{{','}, {','}}},
		{
			`{{{",",","},{",",","},{",",","}}}`, `,`, []int{1, 3, 2}, [][]byte{
				{','}, {','}, {','}, {','}, {','}, {','},
			},
		},
		{`{"\"}"}`, `,`, []int{1}, [][]byte{{'"', '}'}}},
		{`{"\"","\""}`, `,`, []int{2}, [][]byte{{'"'}, {'"'}}},
		{`{{"\"","\""}}`, `,`, []int{1, 2}, [][]byte{{'"'}, {'"'}}},
		{`{{"\""},{"\""}}`, `,`, []int{2, 1}, [][]byte{{'"'}, {'"'}}},
		{
			`{{{"\"","\""},{"\"","\""},{"\"","\""}}}`, `,`, []int{1, 3, 2}, [][]byte{
				{'"'}, {'"'}, {'"'}, {'"'}, {'"'}, {'"'},
			},
		},
		{`{axyzb}`, `xyz`, []int{2}, [][]byte{{'a'}, {'b'}}},
	} {
		dims, elems, err := parseArray([]byte(tt.input), []byte(tt.delim))

		if err != nil {
			t.Fatalf("Expected no error for %q, got %q", tt.input, err)
		}
		if !reflect.DeepEqual(dims, tt.dims) {
			t.Errorf("Expected %v dimensions for %q, got %v", tt.dims, tt.input, dims)
		}
		if !reflect.DeepEqual(elems, tt.elems) {
			t.Errorf("Expected %v elements for %q, got %v", tt.elems, tt.input, elems)
		}
	}
}

func TestParseArrayError(t *testing.T) {
	for _, tt := range []struct {
		input, err string
	}{
		{``, "expected '{' at offset 0"},
		{`x`, "expected '{' at offset 0"},
		{`}`, "expected '{' at offset 0"},
		{`{`, "expected '}' at offset 1"},
		{`{{}`, "expected '}' at offset 3"},
		{`{}}`, "unexpected '}' at offset 2"},
		{`{,}`, "unexpected ',' at offset 1"},
		{`{,x}`, "unexpected ',' at offset 1"},
		{`{x,}`, "unexpected '}' at offset 3"},
		{`{x,{`, "unexpected '{' at offset 3"},
		{`{x},`, "unexpected ',' at offset 3"},
		{`{x}}`, "unexpected '}' at offset 3"},
		{`{{x}`, "expected '}' at offset 4"},
		{`{""x}`, "unexpected 'x' at offset 3"},
		{`{{a},{b,c}}`, "multidimensional arrays must have elements with matching dimensions"},
	} {
		_, _, err := parseArray([]byte(tt.input), []byte{','})

		if err == nil {
			t.Fatalf("Expected error for %q, got none", tt.input)
		}
		if !strings.Contains(err.Error(), tt.err) {
			t.Errorf("Expected error to contain %q for %q, got %q", tt.err, tt.input, err)
		}
	}
}

func TestArrayScanner(t *testing.T) {
	var s sql.Scanner = Array(&[]bool{})
	if _, ok := s.(*BoolArray); !ok {
		t.Errorf("Expected *BoolArray, got %T", s)
	}

	s = Array(&[]float64{})
	if _, ok := s.(*Float64Array); !ok {
		t.Errorf("Expected *Float64Array, got %T", s)
	}

	s = Array(&[]int64{})
	if _, ok := s.(*Int64Array); !ok {
		t.Errorf("Expected *Int64Array, got %T", s)
	}

	s = Array(&[]float32{})
	if _, ok := s.(*Float32Array); !ok {
		t.Errorf("Expected *Float32Array, got %T", s)
	}

	s = Array(&[]int32{})
	if _, ok := s.(*Int32Array); !ok {
		t.Errorf("Expected *Int32Array, got %T", s)
	}

	s = Array(&[]string{})
	if _, ok := s.(*StringArray); !ok {
		t.Errorf("Expected *StringArray, got %T", s)
	}

	s = Array(&[][]byte{})
	if _, ok := s.(*ByteaArray); !ok {
		t.Errorf("Expected *ByteaArray, got %T", s)
	}

	for _, tt := range []interface{}{
		&[]sql.Scanner{},
		&[][]bool{},
		&[][]float64{},
		&[][]int64{},
		&[][]float32{},
		&[][]int32{},
		&[][]string{},
	} {
		s = Array(tt)
		if _, ok := s.(GenericArray); !ok {
			t.Errorf("Expected GenericArray for %T, got %T", tt, s)
		}
	}
}

func TestArrayValuer(t *testing.T) {
	var v driver.Valuer = Array([]bool{})
	if _, ok := v.(*BoolArray); !ok {
		t.Errorf("Expected *BoolArray, got %T", v)
	}

	v = Array([]float64{})
	if _, ok := v.(*Float64Array); !ok {
		t.Errorf("Expected *Float64Array, got %T", v)
	}

	v = Array([]int64{})
	if _, ok := v.(*Int64Array); !ok {
		t.Errorf("Expected *Int64Array, got %T", v)
	}

	v = Array([]float32{})
	if _, ok := v.(*Float32Array); !ok {
		t.Errorf("Expected *Float32Array, got %T", v)
	}

	v = Array([]int32{})
	if _, ok := v.(*Int32Array); !ok {
		t.Errorf("Expected *Int32Array, got %T", v)
	}

	v = Array([]string{})
	if _, ok := v.(*StringArray); !ok {
		t.Errorf("Expected *StringArray, got %T", v)
	}

	v = Array([][]byte{})
	if _, ok := v.(*ByteaArray); !ok {
		t.Errorf("Expected *ByteaArray, got %T", v)
	}

	for _, tt := range []interface{}{
		nil,
		[]driver.Value{},
		[][]bool{},
		[][]float64{},
		[][]int64{},
		[][]float32{},
		[][]int32{},
		[][]string{},
	} {
		v = Array(tt)
		if _, ok := v.(GenericArray); !ok {
			t.Errorf("Expected GenericArray for %T, got %T", tt, v)
		}
	}
}

func TestBoolArrayScanUnsupported(t *testing.T) {
	var arr BoolArray
	err := arr.Scan(1)

	if err == nil {
		t.Fatal("Expected error when scanning from int")
	}
	if !strings.Contains(err.Error(), "int to BoolArray") {
		t.Errorf("Expected type to be mentioned when scanning, got %q", err)
	}
}

func TestBoolArrayScanEmpty(t *testing.T) {
	var arr BoolArray
	err := arr.Scan(`{}`)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr == nil || len(arr) != 0 {
		t.Errorf("Expected empty, got %#v", arr)
	}
}

func TestBoolArrayScanNil(t *testing.T) {
	arr := BoolArray{true, true, true}
	err := arr.Scan(nil)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr != nil {
		t.Errorf("Expected nil, got %+v", arr)
	}
}

var BoolArrayStringTests = []struct {
	str string
	arr BoolArray
}{
	{`{}`, BoolArray{}},
	{`{t}`, BoolArray{true}},
	{`{f,t}`, BoolArray{false, true}},
}

func TestBoolArrayScanBytes(t *testing.T) {
	for _, tt := range BoolArrayStringTests {
		bytes := []byte(tt.str)
		arr := BoolArray{true, true, true}
		err := arr.Scan(bytes)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", bytes, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, bytes, arr)
		}
	}
}

func BenchmarkBoolArrayScanBytes(b *testing.B) {
	var a BoolArray
	var x interface{} = []byte(`{t,f,t,f,t,f,t,f,t,f}`)

	for i := 0; i < b.N; i++ {
		a = BoolArray{}
		a.Scan(x)
	}
}

func TestBoolArrayScanString(t *testing.T) {
	for _, tt := range BoolArrayStringTests {
		arr := BoolArray{true, true, true}
		err := arr.Scan(tt.str)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", tt.str, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, tt.str, arr)
		}
	}
}

func TestBoolArrayScanError(t *testing.T) {
	for _, tt := range []struct {
		input, err string
	}{
		{``, "unable to parse array"},
		{`{`, "unable to parse array"},
		{`{{t},{f}}`, "cannot convert ARRAY[2][1] to BoolArray"},
		{`{NULL}`, `could not parse boolean array index 0: invalid boolean ""`},
		{`{a}`, `could not parse boolean array index 0: invalid boolean "a"`},
		{`{t,b}`, `could not parse boolean array index 1: invalid boolean "b"`},
		{`{t,f,cd}`, `could not parse boolean array index 2: invalid boolean "cd"`},
	} {
		arr := BoolArray{true, true, true}
		err := arr.Scan(tt.input)

		if err == nil {
			t.Fatalf("Expected error for %q, got none", tt.input)
		}
		if !strings.Contains(err.Error(), tt.err) {
			t.Errorf("Expected error to contain %q for %q, got %q", tt.err, tt.input, err)
		}
		if !reflect.DeepEqual(arr, BoolArray{true, true, true}) {
			t.Errorf("Expected destination not to change for %q, got %+v", tt.input, arr)
		}
	}
}

func TestBoolArrayValue(t *testing.T) {
	result, err := BoolArray(nil).Value()

	if err != nil {
		t.Fatalf("Expected no error for nil, got %v", err)
	}
	if result != nil {
		t.Errorf("Expected nil, got %q", result)
	}

	result, err = BoolArray([]bool{}).Value()

	if err != nil {
		t.Fatalf("Expected no error for empty, got %v", err)
	}
	if expected := `{}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected empty, got %q", result)
	}

	result, err = BoolArray([]bool{false, true, false}).Value()

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if expected := `{f,t,f}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected %q, got %q", expected, result)
	}
}

func BenchmarkBoolArrayValue(b *testing.B) {
	rand.Seed(1)
	x := make([]bool, 10)
	for i := 0; i < len(x); i++ {
		x[i] = rand.Intn(2) == 0
	}
	a := BoolArray(x)

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func TestByteaArrayScanUnsupported(t *testing.T) {
	var arr ByteaArray
	err := arr.Scan(1)

	if err == nil {
		t.Fatal("Expected error when scanning from int")
	}
	if !strings.Contains(err.Error(), "int to ByteaArray") {
		t.Errorf("Expected type to be mentioned when scanning, got %q", err)
	}
}

func TestByteaArrayScanEmpty(t *testing.T) {
	var arr ByteaArray
	err := arr.Scan(`{}`)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr == nil || len(arr) != 0 {
		t.Errorf("Expected empty, got %#v", arr)
	}
}

func TestByteaArrayScanNil(t *testing.T) {
	arr := ByteaArray{{2}, {6}, {0, 0}}
	err := arr.Scan(nil)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr != nil {
		t.Errorf("Expected nil, got %+v", arr)
	}
}

var ByteaArrayStringTests = []struct {
	str string
	arr ByteaArray
}{
	{`{}`, ByteaArray{}},
	{`{NULL}`, ByteaArray{nil}},
	{`{"\\xfeff"}`, ByteaArray{{'\xFE', '\xFF'}}},
	{`{"\\xdead","\\xbeef"}`, ByteaArray{{'\xDE', '\xAD'}, {'\xBE', '\xEF'}}},
}

func TestByteaArrayScanBytes(t *testing.T) {
	for _, tt := range ByteaArrayStringTests {
		bytes := []byte(tt.str)
		arr := ByteaArray{{2}, {6}, {0, 0}}
		err := arr.Scan(bytes)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", bytes, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, bytes, arr)
		}
	}
}

func BenchmarkByteaArrayScanBytes(b *testing.B) {
	var a ByteaArray
	var x interface{} = []byte(`{"\\xfe","\\xff","\\xdead","\\xbeef","\\xfe","\\xff","\\xdead","\\xbeef","\\xfe","\\xff"}`)

	for i := 0; i < b.N; i++ {
		a = ByteaArray{}
		a.Scan(x)
	}
}

func TestByteaArrayScanString(t *testing.T) {
	for _, tt := range ByteaArrayStringTests {
		arr := ByteaArray{{2}, {6}, {0, 0}}
		err := arr.Scan(tt.str)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", tt.str, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, tt.str, arr)
		}
	}
}

func TestByteaArrayScanError(t *testing.T) {
	for _, tt := range []struct {
		input, err string
	}{
		{``, "unable to parse array"},
		{`{`, "unable to parse array"},
		{`{{"\\xfeff"},{"\\xbeef"}}`, "cannot convert ARRAY[2][1] to ByteaArray"},
		{`{"\\abc"}`, "could not parse bytea array index 0: could not parse bytea value"},
	} {
		arr := ByteaArray{{2}, {6}, {0, 0}}
		err := arr.Scan(tt.input)

		if err == nil {
			t.Fatalf("Expected error for %q, got none", tt.input)
		}
		if !strings.Contains(err.Error(), tt.err) {
			t.Errorf("Expected error to contain %q for %q, got %q", tt.err, tt.input, err)
		}
		if !reflect.DeepEqual(arr, ByteaArray{{2}, {6}, {0, 0}}) {
			t.Errorf("Expected destination not to change for %q, got %+v", tt.input, arr)
		}
	}
}

func TestByteaArrayValue(t *testing.T) {
	result, err := ByteaArray(nil).Value()

	if err != nil {
		t.Fatalf("Expected no error for nil, got %v", err)
	}
	if result != nil {
		t.Errorf("Expected nil, got %q", result)
	}

	result, err = ByteaArray([][]byte{}).Value()

	if err != nil {
		t.Fatalf("Expected no error for empty, got %v", err)
	}
	if expected := `{}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected empty, got %q", result)
	}

	result, err = ByteaArray([][]byte{{'\xDE', '\xAD', '\xBE', '\xEF'}, {'\xFE', '\xFF'}, {}}).Value()

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if expected := `{"\\xdeadbeef","\\xfeff","\\x"}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected %q, got %q", expected, result)
	}
}

func BenchmarkByteaArrayValue(b *testing.B) {
	rand.Seed(1)
	x := make([][]byte, 10)
	for i := 0; i < len(x); i++ {
		x[i] = make([]byte, len(x))
		for j := 0; j < len(x); j++ {
			x[i][j] = byte(rand.Int())
		}
	}
	a := ByteaArray(x)

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func TestFloat64ArrayScanUnsupported(t *testing.T) {
	var arr Float64Array
	err := arr.Scan(true)

	if err == nil {
		t.Fatal("Expected error when scanning from bool")
	}
	if !strings.Contains(err.Error(), "bool to Float64Array") {
		t.Errorf("Expected type to be mentioned when scanning, got %q", err)
	}
}

func TestFloat64ArrayScanEmpty(t *testing.T) {
	var arr Float64Array
	err := arr.Scan(`{}`)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr == nil || len(arr) != 0 {
		t.Errorf("Expected empty, got %#v", arr)
	}
}

func TestFloat64ArrayScanNil(t *testing.T) {
	arr := Float64Array{5, 5, 5}
	err := arr.Scan(nil)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr != nil {
		t.Errorf("Expected nil, got %+v", arr)
	}
}

var Float64ArrayStringTests = []struct {
	str string
	arr Float64Array
}{
	{`{}`, Float64Array{}},
	{`{1.2}`, Float64Array{1.2}},
	{`{3.456,7.89}`, Float64Array{3.456, 7.89}},
	{`{3,1,2}`, Float64Array{3, 1, 2}},
}

func TestFloat64ArrayScanBytes(t *testing.T) {
	for _, tt := range Float64ArrayStringTests {
		bytes := []byte(tt.str)
		arr := Float64Array{5, 5, 5}
		err := arr.Scan(bytes)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", bytes, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, bytes, arr)
		}
	}
}

func BenchmarkFloat64ArrayScanBytes(b *testing.B) {
	var a Float64Array
	var x interface{} = []byte(`{1.2,3.4,5.6,7.8,9.01,2.34,5.67,8.90,1.234,5.678}`)

	for i := 0; i < b.N; i++ {
		a = Float64Array{}
		a.Scan(x)
	}
}

func TestFloat64ArrayScanString(t *testing.T) {
	for _, tt := range Float64ArrayStringTests {
		arr := Float64Array{5, 5, 5}
		err := arr.Scan(tt.str)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", tt.str, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, tt.str, arr)
		}
	}
}

func TestFloat64ArrayScanError(t *testing.T) {
	for _, tt := range []struct {
		input, err string
	}{
		{``, "unable to parse array"},
		{`{`, "unable to parse array"},
		{`{{5.6},{7.8}}`, "cannot convert ARRAY[2][1] to Float64Array"},
		{`{NULL}`, "parsing array element index 0:"},
		{`{a}`, "parsing array element index 0:"},
		{`{5.6,a}`, "parsing array element index 1:"},
		{`{5.6,7.8,a}`, "parsing array element index 2:"},
	} {
		arr := Float64Array{5, 5, 5}
		err := arr.Scan(tt.input)

		if err == nil {
			t.Fatalf("Expected error for %q, got none", tt.input)
		}
		if !strings.Contains(err.Error(), tt.err) {
			t.Errorf("Expected error to contain %q for %q, got %q", tt.err, tt.input, err)
		}
		if !reflect.DeepEqual(arr, Float64Array{5, 5, 5}) {
			t.Errorf("Expected destination not to change for %q, got %+v", tt.input, arr)
		}
	}
}

func TestFloat64ArrayValue(t *testing.T) {
	result, err := Float64Array(nil).Value()

	if err != nil {
		t.Fatalf("Expected no error for nil, got %v", err)
	}
	if result != nil {
		t.Errorf("Expected nil, got %q", result)
	}

	result, err = Float64Array([]float64{}).Value()

	if err != nil {
		t.Fatalf("Expected no error for empty, got %v", err)
	}
	if expected := `{}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected empty, got %q", result)
	}

	result, err = Float64Array([]float64{1.2, 3.4, 5.6}).Value()

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if expected := `{1.2,3.4,5.6}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected %q, got %q", expected, result)
	}
}

func BenchmarkFloat64ArrayValue(b *testing.B) {
	rand.Seed(1)
	x := make([]float64, 10)
	for i := 0; i < len(x); i++ {
		x[i] = rand.NormFloat64()
	}
	a := Float64Array(x)

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func TestInt64ArrayScanUnsupported(t *testing.T) {
	var arr Int64Array
	err := arr.Scan(true)

	if err == nil {
		t.Fatal("Expected error when scanning from bool")
	}
	if !strings.Contains(err.Error(), "bool to Int64Array") {
		t.Errorf("Expected type to be mentioned when scanning, got %q", err)
	}
}

func TestInt64ArrayScanEmpty(t *testing.T) {
	var arr Int64Array
	err := arr.Scan(`{}`)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr == nil || len(arr) != 0 {
		t.Errorf("Expected empty, got %#v", arr)
	}
}

func TestInt64ArrayScanNil(t *testing.T) {
	arr := Int64Array{5, 5, 5}
	err := arr.Scan(nil)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr != nil {
		t.Errorf("Expected nil, got %+v", arr)
	}
}

var Int64ArrayStringTests = []struct {
	str string
	arr Int64Array
}{
	{`{}`, Int64Array{}},
	{`{12}`, Int64Array{12}},
	{`{345,678}`, Int64Array{345, 678}},
}

func TestInt64ArrayScanBytes(t *testing.T) {
	for _, tt := range Int64ArrayStringTests {
		bytes := []byte(tt.str)
		arr := Int64Array{5, 5, 5}
		err := arr.Scan(bytes)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", bytes, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, bytes, arr)
		}
	}
}

func BenchmarkInt64ArrayScanBytes(b *testing.B) {
	var a Int64Array
	var x interface{} = []byte(`{1,2,3,4,5,6,7,8,9,0}`)

	for i := 0; i < b.N; i++ {
		a = Int64Array{}
		a.Scan(x)
	}
}

func TestInt64ArrayScanString(t *testing.T) {
	for _, tt := range Int64ArrayStringTests {
		arr := Int64Array{5, 5, 5}
		err := arr.Scan(tt.str)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", tt.str, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, tt.str, arr)
		}
	}
}

func TestInt64ArrayScanError(t *testing.T) {
	for _, tt := range []struct {
		input, err string
	}{
		{``, "unable to parse array"},
		{`{`, "unable to parse array"},
		{`{{5},{6}}`, "cannot convert ARRAY[2][1] to Int64Array"},
		{`{NULL}`, "parsing array element index 0:"},
		{`{a}`, "parsing array element index 0:"},
		{`{5,a}`, "parsing array element index 1:"},
		{`{5,6,a}`, "parsing array element index 2:"},
	} {
		arr := Int64Array{5, 5, 5}
		err := arr.Scan(tt.input)

		if err == nil {
			t.Fatalf("Expected error for %q, got none", tt.input)
		}
		if !strings.Contains(err.Error(), tt.err) {
			t.Errorf("Expected error to contain %q for %q, got %q", tt.err, tt.input, err)
		}
		if !reflect.DeepEqual(arr, Int64Array{5, 5, 5}) {
			t.Errorf("Expected destination not to change for %q, got %+v", tt.input, arr)
		}
	}
}

func TestInt64ArrayValue(t *testing.T) {
	result, err := Int64Array(nil).Value()

	if err != nil {
		t.Fatalf("Expected no error for nil, got %v", err)
	}
	if result != nil {
		t.Errorf("Expected nil, got %q", result)
	}

	result, err = Int64Array([]int64{}).Value()

	if err != nil {
		t.Fatalf("Expected no error for empty, got %v", err)
	}
	if expected := `{}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected empty, got %q", result)
	}

	result, err = Int64Array([]int64{1, 2, 3}).Value()

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if expected := `{1,2,3}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected %q, got %q", expected, result)
	}
}

func BenchmarkInt64ArrayValue(b *testing.B) {
	rand.Seed(1)
	x := make([]int64, 10)
	for i := 0; i < len(x); i++ {
		x[i] = rand.Int63()
	}
	a := Int64Array(x)

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func TestFloat32ArrayScanUnsupported(t *testing.T) {
	var arr Float32Array
	err := arr.Scan(true)

	if err == nil {
		t.Fatal("Expected error when scanning from bool")
	}
	if !strings.Contains(err.Error(), "bool to Float32Array") {
		t.Errorf("Expected type to be mentioned when scanning, got %q", err)
	}
}

func TestFloat32ArrayScanEmpty(t *testing.T) {
	var arr Float32Array
	err := arr.Scan(`{}`)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr == nil || len(arr) != 0 {
		t.Errorf("Expected empty, got %#v", arr)
	}
}

func TestFloat32ArrayScanNil(t *testing.T) {
	arr := Float32Array{5, 5, 5}
	err := arr.Scan(nil)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr != nil {
		t.Errorf("Expected nil, got %+v", arr)
	}
}

var Float32ArrayStringTests = []struct {
	str string
	arr Float32Array
}{
	{`{}`, Float32Array{}},
	{`{1.2}`, Float32Array{1.2}},
	{`{3.456,7.89}`, Float32Array{3.456, 7.89}},
	{`{3,1,2}`, Float32Array{3, 1, 2}},
}

func TestFloat32ArrayScanBytes(t *testing.T) {
	for _, tt := range Float32ArrayStringTests {
		bytes := []byte(tt.str)
		arr := Float32Array{5, 5, 5}
		err := arr.Scan(bytes)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", bytes, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, bytes, arr)
		}
	}
}

func BenchmarkFloat32ArrayScanBytes(b *testing.B) {
	var a Float32Array
	var x interface{} = []byte(`{1.2,3.4,5.6,7.8,9.01,2.34,5.67,8.90,1.234,5.678}`)

	for i := 0; i < b.N; i++ {
		a = Float32Array{}
		a.Scan(x)
	}
}

func TestFloat32ArrayScanString(t *testing.T) {
	for _, tt := range Float32ArrayStringTests {
		arr := Float32Array{5, 5, 5}
		err := arr.Scan(tt.str)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", tt.str, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, tt.str, arr)
		}
	}
}

func TestFloat32ArrayScanError(t *testing.T) {
	for _, tt := range []struct {
		input, err string
	}{
		{``, "unable to parse array"},
		{`{`, "unable to parse array"},
		{`{{5.6},{7.8}}`, "cannot convert ARRAY[2][1] to Float32Array"},
		{`{NULL}`, "parsing array element index 0:"},
		{`{a}`, "parsing array element index 0:"},
		{`{5.6,a}`, "parsing array element index 1:"},
		{`{5.6,7.8,a}`, "parsing array element index 2:"},
	} {
		arr := Float32Array{5, 5, 5}
		err := arr.Scan(tt.input)

		if err == nil {
			t.Fatalf("Expected error for %q, got none", tt.input)
		}
		if !strings.Contains(err.Error(), tt.err) {
			t.Errorf("Expected error to contain %q for %q, got %q", tt.err, tt.input, err)
		}
		if !reflect.DeepEqual(arr, Float32Array{5, 5, 5}) {
			t.Errorf("Expected destination not to change for %q, got %+v", tt.input, arr)
		}
	}
}

func TestFloat32ArrayValue(t *testing.T) {
	result, err := Float32Array(nil).Value()

	if err != nil {
		t.Fatalf("Expected no error for nil, got %v", err)
	}
	if result != nil {
		t.Errorf("Expected nil, got %q", result)
	}

	result, err = Float32Array([]float32{}).Value()

	if err != nil {
		t.Fatalf("Expected no error for empty, got %v", err)
	}
	if expected := `{}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected empty, got %q", result)
	}

	result, err = Float32Array([]float32{1.2, 3.4, 5.6}).Value()

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if expected := `{1.2,3.4,5.6}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected %q, got %q", expected, result)
	}
}

func BenchmarkFloat32ArrayValue(b *testing.B) {
	rand.Seed(1)
	x := make([]float32, 10)
	for i := 0; i < len(x); i++ {
		x[i] = rand.Float32()
	}
	a := Float32Array(x)

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func TestInt32ArrayScanUnsupported(t *testing.T) {
	var arr Int32Array
	err := arr.Scan(true)

	if err == nil {
		t.Fatal("Expected error when scanning from bool")
	}
	if !strings.Contains(err.Error(), "bool to Int32Array") {
		t.Errorf("Expected type to be mentioned when scanning, got %q", err)
	}
}

func TestInt32ArrayScanEmpty(t *testing.T) {
	var arr Int32Array
	err := arr.Scan(`{}`)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr == nil || len(arr) != 0 {
		t.Errorf("Expected empty, got %#v", arr)
	}
}

func TestInt32ArrayScanNil(t *testing.T) {
	arr := Int32Array{5, 5, 5}
	err := arr.Scan(nil)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr != nil {
		t.Errorf("Expected nil, got %+v", arr)
	}
}

var Int32ArrayStringTests = []struct {
	str string
	arr Int32Array
}{
	{`{}`, Int32Array{}},
	{`{12}`, Int32Array{12}},
	{`{345,678}`, Int32Array{345, 678}},
}

func TestInt32ArrayScanBytes(t *testing.T) {
	for _, tt := range Int32ArrayStringTests {
		bytes := []byte(tt.str)
		arr := Int32Array{5, 5, 5}
		err := arr.Scan(bytes)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", bytes, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, bytes, arr)
		}
	}
}

func BenchmarkInt32ArrayScanBytes(b *testing.B) {
	var a Int32Array
	var x interface{} = []byte(`{1,2,3,4,5,6,7,8,9,0}`)

	for i := 0; i < b.N; i++ {
		a = Int32Array{}
		a.Scan(x)
	}
}

func TestInt32ArrayScanString(t *testing.T) {
	for _, tt := range Int32ArrayStringTests {
		arr := Int32Array{5, 5, 5}
		err := arr.Scan(tt.str)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", tt.str, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, tt.str, arr)
		}
	}
}

func TestInt32ArrayScanError(t *testing.T) {
	for _, tt := range []struct {
		input, err string
	}{
		{``, "unable to parse array"},
		{`{`, "unable to parse array"},
		{`{{5},{6}}`, "cannot convert ARRAY[2][1] to Int32Array"},
		{`{NULL}`, "parsing array element index 0:"},
		{`{a}`, "parsing array element index 0:"},
		{`{5,a}`, "parsing array element index 1:"},
		{`{5,6,a}`, "parsing array element index 2:"},
	} {
		arr := Int32Array{5, 5, 5}
		err := arr.Scan(tt.input)

		if err == nil {
			t.Fatalf("Expected error for %q, got none", tt.input)
		}
		if !strings.Contains(err.Error(), tt.err) {
			t.Errorf("Expected error to contain %q for %q, got %q", tt.err, tt.input, err)
		}
		if !reflect.DeepEqual(arr, Int32Array{5, 5, 5}) {
			t.Errorf("Expected destination not to change for %q, got %+v", tt.input, arr)
		}
	}
}

func TestInt32ArrayValue(t *testing.T) {
	result, err := Int32Array(nil).Value()

	if err != nil {
		t.Fatalf("Expected no error for nil, got %v", err)
	}
	if result != nil {
		t.Errorf("Expected nil, got %q", result)
	}

	result, err = Int32Array([]int32{}).Value()

	if err != nil {
		t.Fatalf("Expected no error for empty, got %v", err)
	}
	if expected := `{}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected empty, got %q", result)
	}

	result, err = Int32Array([]int32{1, 2, 3}).Value()

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if expected := `{1,2,3}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected %q, got %q", expected, result)
	}
}

func BenchmarkInt32ArrayValue(b *testing.B) {
	rand.Seed(1)
	x := make([]int32, 10)
	for i := 0; i < len(x); i++ {
		x[i] = rand.Int31()
	}
	a := Int32Array(x)

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func TestStringArrayScanUnsupported(t *testing.T) {
	var arr StringArray
	err := arr.Scan(true)

	if err == nil {
		t.Fatal("Expected error when scanning from bool")
	}
	if !strings.Contains(err.Error(), "bool to StringArray") {
		t.Errorf("Expected type to be mentioned when scanning, got %q", err)
	}
}

func TestStringArrayScanEmpty(t *testing.T) {
	var arr StringArray
	err := arr.Scan(`{}`)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr == nil || len(arr) != 0 {
		t.Errorf("Expected empty, got %#v", arr)
	}
}

func TestStringArrayScanNil(t *testing.T) {
	arr := StringArray{"x", "x", "x"}
	err := arr.Scan(nil)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if arr != nil {
		t.Errorf("Expected nil, got %+v", arr)
	}
}

var StringArrayStringTests = []struct {
	str string
	arr StringArray
}{
	{`{}`, StringArray{}},
	{`{t}`, StringArray{"t"}},
	{`{f,1}`, StringArray{"f", "1"}},
	{`{"a\\b","c d",","}`, StringArray{"a\\b", "c d", ","}},
}

func TestStringArrayScanBytes(t *testing.T) {
	for _, tt := range StringArrayStringTests {
		bytes := []byte(tt.str)
		arr := StringArray{"x", "x", "x"}
		err := arr.Scan(bytes)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", bytes, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, bytes, arr)
		}
	}
}

func BenchmarkStringArrayScanBytes(b *testing.B) {
	var a StringArray
	var x interface{} = []byte(`{a,b,c,d,e,f,g,h,i,j}`)
	var y interface{} = []byte(`{"\a","\b","\c","\d","\e","\f","\g","\h","\i","\j"}`)

	for i := 0; i < b.N; i++ {
		a = StringArray{}
		a.Scan(x)
		a = StringArray{}
		a.Scan(y)
	}
}

func TestStringArrayScanString(t *testing.T) {
	for _, tt := range StringArrayStringTests {
		arr := StringArray{"x", "x", "x"}
		err := arr.Scan(tt.str)

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", tt.str, err)
		}
		if !reflect.DeepEqual(arr, tt.arr) {
			t.Errorf("Expected %+v for %q, got %+v", tt.arr, tt.str, arr)
		}
	}
}

func TestStringArrayScanError(t *testing.T) {
	for _, tt := range []struct {
		input, err string
	}{
		{``, "unable to parse array"},
		{`{`, "unable to parse array"},
		{`{{a},{b}}`, "cannot convert ARRAY[2][1] to StringArray"},
		{`{NULL}`, "parsing array element index 0: cannot convert nil to string"},
		{`{a,NULL}`, "parsing array element index 1: cannot convert nil to string"},
		{`{a,b,NULL}`, "parsing array element index 2: cannot convert nil to string"},
	} {
		arr := StringArray{"x", "x", "x"}
		err := arr.Scan(tt.input)

		if err == nil {
			t.Fatalf("Expected error for %q, got none", tt.input)
		}
		if !strings.Contains(err.Error(), tt.err) {
			t.Errorf("Expected error to contain %q for %q, got %q", tt.err, tt.input, err)
		}
		if !reflect.DeepEqual(arr, StringArray{"x", "x", "x"}) {
			t.Errorf("Expected destination not to change for %q, got %+v", tt.input, arr)
		}
	}
}

func TestStringArrayValue(t *testing.T) {
	result, err := StringArray(nil).Value()

	if err != nil {
		t.Fatalf("Expected no error for nil, got %v", err)
	}
	if result != nil {
		t.Errorf("Expected nil, got %q", result)
	}

	result, err = StringArray([]string{}).Value()

	if err != nil {
		t.Fatalf("Expected no error for empty, got %v", err)
	}
	if expected := `{}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected empty, got %q", result)
	}

	result, err = StringArray([]string{`a`, `\b`, `c"`, `d,e`}).Value()

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if expected := `{"a","\\b","c\"","d,e"}`; !reflect.DeepEqual(result, expected) {
		t.Errorf("Expected %q, got %q", expected, result)
	}
}

func BenchmarkStringArrayValue(b *testing.B) {
	x := make([]string, 10)
	for i := 0; i < len(x); i++ {
		x[i] = strings.Repeat(`abc"def\ghi`, 5)
	}
	a := StringArray(x)

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func TestGenericArrayScanUnsupported(t *testing.T) {
	var s string
	var ss []string
	var nsa [1]sql.NullString

	for _, tt := range []struct {
		src, dest interface{}
		err       string
	}{
		{nil, nil, "destination <nil> is not a pointer to array or slice"},
		{nil, true, "destination bool is not a pointer to array or slice"},
		{nil, &s, "destination *string is not a pointer to array or slice"},
		{nil, ss, "destination []string is not a pointer to array or slice"},
		{nil, &nsa, "<nil> to [1]sql.NullString"},
		{true, &ss, "bool to []string"},
		{`{{x}}`, &ss, "multidimensional ARRAY[1][1] is not implemented"},
		{`{{x},{x}}`, &ss, "multidimensional ARRAY[2][1] is not implemented"},
		{`{x}`, &ss, "scanning to string is not implemented"},
	} {
		err := GenericArray{tt.dest}.Scan(tt.src)

		if err == nil {
			t.Fatalf("Expected error for [%#v %#v]", tt.src, tt.dest)
		}
		if !strings.Contains(err.Error(), tt.err) {
			t.Errorf("Expected error to contain %q for [%#v %#v], got %q", tt.err, tt.src, tt.dest, err)
		}
	}
}

func TestGenericArrayScanScannerArrayBytes(t *testing.T) {
	src, expected, nsa := []byte(`{NULL,abc,"\""}`),
		[3]sql.NullString{{}, {String: `abc`, Valid: true}, {String: `"`, Valid: true}},
		[3]sql.NullString{{String: ``, Valid: true}, {}, {}}

	if err := (GenericArray{&nsa}).Scan(src); err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if !reflect.DeepEqual(nsa, expected) {
		t.Errorf("Expected %v, got %v", expected, nsa)
	}
}

func TestGenericArrayScanScannerArrayString(t *testing.T) {
	src, expected, nsa := `{NULL,"\"",xyz}`,
		[3]sql.NullString{{}, {String: `"`, Valid: true}, {String: `xyz`, Valid: true}},
		[3]sql.NullString{{String: ``, Valid: true}, {}, {}}

	if err := (GenericArray{&nsa}).Scan(src); err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if !reflect.DeepEqual(nsa, expected) {
		t.Errorf("Expected %v, got %v", expected, nsa)
	}
}

func TestGenericArrayScanScannerSliceEmpty(t *testing.T) {
	var nss []sql.NullString

	if err := (GenericArray{&nss}).Scan(`{}`); err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if nss == nil || len(nss) != 0 {
		t.Errorf("Expected empty, got %#v", nss)
	}
}

func TestGenericArrayScanScannerSliceNil(t *testing.T) {
	nss := []sql.NullString{{String: ``, Valid: true}, {}}

	if err := (GenericArray{&nss}).Scan(nil); err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if nss != nil {
		t.Errorf("Expected nil, got %+v", nss)
	}
}

func TestGenericArrayScanScannerSliceBytes(t *testing.T) {
	src, expected, nss := []byte(`{NULL,abc,"\""}`),
		[]sql.NullString{{}, {String: `abc`, Valid: true}, {String: `"`, Valid: true}},
		[]sql.NullString{{String: ``, Valid: true}, {}, {}, {}, {}}

	if err := (GenericArray{&nss}).Scan(src); err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if !reflect.DeepEqual(nss, expected) {
		t.Errorf("Expected %v, got %v", expected, nss)
	}
}

func BenchmarkGenericArrayScanScannerSliceBytes(b *testing.B) {
	var a GenericArray
	var x interface{} = []byte(`{a,b,c,d,e,f,g,h,i,j}`)
	var y interface{} = []byte(`{"\a","\b","\c","\d","\e","\f","\g","\h","\i","\j"}`)

	for i := 0; i < b.N; i++ {
		a = GenericArray{new([]sql.NullString)}
		a.Scan(x)
		a = GenericArray{new([]sql.NullString)}
		a.Scan(y)
	}
}

func TestGenericArrayScanScannerSliceString(t *testing.T) {
	src, expected, nss := `{NULL,"\"",xyz}`,
		[]sql.NullString{{}, {String: `"`, Valid: true}, {String: `xyz`, Valid: true}},
		[]sql.NullString{{String: ``, Valid: true}, {}, {}}

	if err := (GenericArray{&nss}).Scan(src); err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if !reflect.DeepEqual(nss, expected) {
		t.Errorf("Expected %v, got %v", expected, nss)
	}
}

type TildeNullInt64 struct{ sql.NullInt64 }

func (TildeNullInt64) ArrayDelimiter() string { return "~" }

func TestGenericArrayScanDelimiter(t *testing.T) {
	src, expected, tnis := `{12~NULL~76}`,
		[]TildeNullInt64{{sql.NullInt64{Int64: 12, Valid: true}}, {}, {sql.NullInt64{Int64: 76, Valid: true}}},
		[]TildeNullInt64{{sql.NullInt64{Int64: 0, Valid: true}}, {}}

	if err := (GenericArray{&tnis}).Scan(src); err != nil {
		t.Fatalf("Expected no error for %#v, got %v", src, err)
	}
	if !reflect.DeepEqual(tnis, expected) {
		t.Errorf("Expected %v for %#v, got %v", expected, src, tnis)
	}
}

func TestGenericArrayScanErrors(t *testing.T) {
	var sa [1]string
	var nis []sql.NullInt64
	var pss *[]string

	for _, tt := range []struct {
		src, dest interface{}
		err       string
	}{
		{nil, pss, "destination *[]string is nil"},
		{`{`, &sa, "unable to parse"},
		{`{}`, &sa, "cannot convert ARRAY[0] to [1]string"},
		{`{x,x}`, &sa, "cannot convert ARRAY[2] to [1]string"},
		{`{x}`, &nis, `parsing array element index 0: converting`},
	} {
		err := GenericArray{tt.dest}.Scan(tt.src)

		if err == nil {
			t.Fatalf("Expected error for [%#v %#v]", tt.src, tt.dest)
		}
		if !strings.Contains(err.Error(), tt.err) {
			t.Errorf("Expected error to contain %q for [%#v %#v], got %q", tt.err, tt.src, tt.dest, err)
		}
	}
}

func TestGenericArrayValueUnsupported(t *testing.T) {
	_, err := GenericArray{true}.Value()

	if err == nil {
		t.Fatal("Expected error for bool")
	}
	if !strings.Contains(err.Error(), "bool to array") {
		t.Errorf("Expected type to be mentioned, got %q", err)
	}
}

type ByteArrayValuer [1]byte
type ByteSliceValuer []byte
type FuncArrayValuer struct {
	delimiter func() string
	value     func() (driver.Value, error)
}

func (a ByteArrayValuer) Value() (driver.Value, error) { return a[:], nil }
func (b ByteSliceValuer) Value() (driver.Value, error) { return []byte(b), nil }
func (f FuncArrayValuer) ArrayDelimiter() string       { return f.delimiter() }
func (f FuncArrayValuer) Value() (driver.Value, error) { return f.value() }

func TestGenericArrayValue(t *testing.T) {
	result, err := GenericArray{nil}.Value()

	if err != nil {
		t.Fatalf("Expected no error for nil, got %v", err)
	}
	if result != nil {
		t.Errorf("Expected nil, got %q", result)
	}

	for _, tt := range []interface{}{
		[]bool(nil),
		[][]int(nil),
		[]*int(nil),
		[]sql.NullString(nil),
	} {
		result, err := GenericArray{tt}.Value()

		if err != nil {
			t.Fatalf("Expected no error for %#v, got %v", tt, err)
		}
		if result != nil {
			t.Errorf("Expected nil for %#v, got %q", tt, result)
		}
	}

	Tilde := func(v driver.Value) FuncArrayValuer {
		return FuncArrayValuer{
			func() string { return "~" },
			func() (driver.Value, error) { return v, nil }}
	}

	for _, tt := range []struct {
		result string
		input  interface{}
	}{
		{`{}`, []bool{}},
		{`{true}`, []bool{true}},
		{`{true,false}`, []bool{true, false}},
		{`{true,false}`, [2]bool{true, false}},

		{`{}`, [][]int{{}}},
		{`{}`, [][]int{{}, {}}},
		{`{{1}}`, [][]int{{1}}},
		{`{{1},{2}}`, [][]int{{1}, {2}}},
		{`{{1,2},{3,4}}`, [][]int{{1, 2}, {3, 4}}},
		{`{{1,2},{3,4}}`, [2][2]int{{1, 2}, {3, 4}}},

		{`{"a","\\b","c\"","d,e"}`, []string{`a`, `\b`, `c"`, `d,e`}},
		{`{"a","\\b","c\"","d,e"}`, [][]byte{{'a'}, {'\\', 'b'}, {'c', '"'}, {'d', ',', 'e'}}},

		{`{NULL}`, []*int{nil}},
		{`{0,NULL}`, []*int{new(int), nil}},

		{`{NULL}`, []sql.NullString{{}}},
		{`{"\"",NULL}`, []sql.NullString{{String: `"`, Valid: true}, {}}},

		{`{"a","b"}`, []ByteArrayValuer{{'a'}, {'b'}}},
		{`{{"a","b"},{"c","d"}}`, [][]ByteArrayValuer{{{'a'}, {'b'}}, {{'c'}, {'d'}}}},

		{`{"e","f"}`, []ByteSliceValuer{{'e'}, {'f'}}},
		{`{{"e","f"},{"g","h"}}`, [][]ByteSliceValuer{{{'e'}, {'f'}}, {{'g'}, {'h'}}}},

		{`{1~2}`, []FuncArrayValuer{Tilde(int64(1)), Tilde(int64(2))}},
		{`{{1~2}~{3~4}}`, [][]FuncArrayValuer{{Tilde(int64(1)), Tilde(int64(2))}, {Tilde(int64(3)), Tilde(int64(4))}}},
	} {
		result, err := GenericArray{tt.input}.Value()

		if err != nil {
			t.Fatalf("Expected no error for %q, got %v", tt.input, err)
		}
		if !reflect.DeepEqual(result, tt.result) {
			t.Errorf("Expected %q for %q, got %q", tt.result, tt.input, result)
		}
	}
}

func TestGenericArrayValueErrors(t *testing.T) {
	v := []interface{}{func() {}}
	if _, err := (GenericArray{v}).Value(); err == nil {
		t.Errorf("Expected error for %q, got nil", v)
	}

	v = []interface{}{nil, func() {}}
	if _, err := (GenericArray{v}).Value(); err == nil {
		t.Errorf("Expected error for %q, got nil", v)
	}
}

func BenchmarkGenericArrayValueBools(b *testing.B) {
	rand.Seed(1)
	x := make([]bool, 10)
	for i := 0; i < len(x); i++ {
		x[i] = rand.Intn(2) == 0
	}
	a := GenericArray{x}

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func BenchmarkGenericArrayValueFloat64s(b *testing.B) {
	rand.Seed(1)
	x := make([]float64, 10)
	for i := 0; i < len(x); i++ {
		x[i] = rand.NormFloat64()
	}
	a := GenericArray{x}

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func BenchmarkGenericArrayValueInt64s(b *testing.B) {
	rand.Seed(1)
	x := make([]int64, 10)
	for i := 0; i < len(x); i++ {
		x[i] = rand.Int63()
	}
	a := GenericArray{x}

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func BenchmarkGenericArrayValueByteSlices(b *testing.B) {
	x := make([][]byte, 10)
	for i := 0; i < len(x); i++ {
		x[i] = bytes.Repeat([]byte(`abc"def\ghi`), 5)
	}
	a := GenericArray{x}

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func BenchmarkGenericArrayValueStrings(b *testing.B) {
	x := make([]string, 10)
	for i := 0; i < len(x); i++ {
		x[i] = strings.Repeat(`abc"def\ghi`, 5)
	}
	a := GenericArray{x}

	for i := 0; i < b.N; i++ {
		a.Value()
	}
}

func TestArrayScanBackend(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	for _, tt := range []struct {
		s string
		d sql.Scanner
		e interface{}
	}{
		{`ARRAY[true, false]`, new(BoolArray), &BoolArray{true, false}},
		{`ARRAY[E'\\xdead', E'\\xbeef']`, new(ByteaArray), &ByteaArray{{'\xDE', '\xAD'}, {'\xBE', '\xEF'}}},
		{`ARRAY[1.2, 3.4]`, new(Float64Array), &Float64Array{1.2, 3.4}},
		{`ARRAY[1, 2, 3]`, new(Int64Array), &Int64Array{1, 2, 3}},
		{`ARRAY['a', E'\\b', 'c"', 'd,e']`, new(StringArray), &StringArray{`a`, `\b`, `c"`, `d,e`}},
	} {
		err := db.QueryRow(`SELECT ` + tt.s).Scan(tt.d)
		if err != nil {
			t.Errorf("Expected no error when scanning %s into %T, got %v", tt.s, tt.d, err)
		}
		if !reflect.DeepEqual(tt.d, tt.e) {
			t.Errorf("Expected %v when scanning %s into %T, got %v", tt.e, tt.s, tt.d, tt.d)
		}
	}
}

func TestArrayValueBackend(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	for _, tt := range []struct {
		s string
		v driver.Valuer
	}{
		{`ARRAY[true, false]`, BoolArray{true, false}},
		{`ARRAY[E'\\xdead', E'\\xbeef']`, ByteaArray{{'\xDE', '\xAD'}, {'\xBE', '\xEF'}}},
		{`ARRAY[1.2, 3.4]`, Float64Array{1.2, 3.4}},
		{`ARRAY[1, 2, 3]`, Int64Array{1, 2, 3}},
		{`ARRAY['a', E'\\b', 'c"', 'd,e']`, StringArray{`a`, `\b`, `c"`, `d,e`}},
	} {
		var x int
		err := db.QueryRow(`SELECT 1 WHERE `+tt.s+` <> $1`, tt.v).Scan(&x)
		if err != sql.ErrNoRows {
			t.Errorf("Expected %v to equal %s, got %v", tt.v, tt.s, err)
		}
	}
}
