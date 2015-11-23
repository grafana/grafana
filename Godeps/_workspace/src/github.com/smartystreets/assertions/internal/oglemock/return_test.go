// Copyright 2011 Aaron Jacobs. All Rights Reserved.
// Author: aaronjjacobs@gmail.com (Aaron Jacobs)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package oglemock_test

import (
	"bytes"
	. "github.com/smartystreets/assertions/internal/oglematchers"
	"github.com/smartystreets/assertions/internal/oglemock"
	. "github.com/smartystreets/assertions/internal/ogletest"
	"io"
	"math"
	"reflect"
	"testing"
	"unsafe"
)

////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////

var someInt int = 17

type ReturnTest struct {
}

func init()                     { RegisterTestSuite(&ReturnTest{}) }
func TestOgletest(t *testing.T) { RunTests(t) }

type returnTestCase struct {
	suppliedVal                        interface{}
	expectedVal                        interface{}
	expectedSetSignatureErrorSubstring string
}

func (t *ReturnTest) runTestCases(signature reflect.Type, cases []returnTestCase) {
	for i, c := range cases {
		a := oglemock.Return(c.suppliedVal)

		// SetSignature
		err := a.SetSignature(signature)
		if c.expectedSetSignatureErrorSubstring == "" {
			ExpectEq(nil, err, "Test case %d: %v", i, c)

			if err != nil {
				continue
			}
		} else {
			ExpectThat(err, Error(HasSubstr(c.expectedSetSignatureErrorSubstring)),
				"Test case %d: %v", i, c)
			continue
		}

		// Invoke
		res := a.Invoke([]interface{}{})
		AssertThat(res, ElementsAre(Any()))
		ExpectThat(res[0], IdenticalTo(c.expectedVal), "Test case %d: %v", i, c)
	}
}

////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////

func (t *ReturnTest) SetSignatureNotCalled() {
	a := oglemock.Return()
	f := func() { a.Invoke([]interface{}{}) }
	ExpectThat(f, Panics(MatchesRegexp("first call SetSignature")))
}

func (t *ReturnTest) NoReturnValues() {
	sig := reflect.TypeOf(func() {})
	var a oglemock.Action
	var err error
	var vals []interface{}

	// No values.
	a = oglemock.Return()
	err = a.SetSignature(sig)
	AssertEq(nil, err)

	vals = a.Invoke([]interface{}{})
	ExpectThat(vals, ElementsAre())

	// One value.
	a = oglemock.Return(17)
	err = a.SetSignature(sig)
	ExpectThat(err, Error(HasSubstr("given 1 val")))
	ExpectThat(err, Error(HasSubstr("expected 0")))

	// Two values.
	a = oglemock.Return(17, 19)
	err = a.SetSignature(sig)
	ExpectThat(err, Error(HasSubstr("given 2 vals")))
	ExpectThat(err, Error(HasSubstr("expected 0")))
}

func (t *ReturnTest) MultipleReturnValues() {
	sig := reflect.TypeOf(func() (int, string) { return 0, "" })
	var a oglemock.Action
	var err error
	var vals []interface{}

	// No values.
	a = oglemock.Return()
	err = a.SetSignature(sig)
	ExpectThat(err, Error(HasSubstr("given 0 vals")))
	ExpectThat(err, Error(HasSubstr("expected 2")))

	// One value.
	a = oglemock.Return(17)
	err = a.SetSignature(sig)
	ExpectThat(err, Error(HasSubstr("given 1 val")))
	ExpectThat(err, Error(HasSubstr("expected 2")))

	// Two values.
	a = oglemock.Return(17, "taco")
	err = a.SetSignature(sig)
	AssertEq(nil, err)

	vals = a.Invoke([]interface{}{})
	ExpectThat(vals, ElementsAre(IdenticalTo(int(17)), "taco"))
}

func (t *ReturnTest) Bool() {
	sig := reflect.TypeOf(func() bool { return false })
	cases := []returnTestCase{
		// Identical types.
		{bool(true), bool(true), ""},
		{bool(false), bool(false), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Int() {
	sig := reflect.TypeOf(func() int { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{int(math.MinInt32), int(math.MinInt32), ""},
		{int(math.MaxInt32), int(math.MaxInt32), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Int8() {
	sig := reflect.TypeOf(func() int8 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{int8(math.MinInt8), int8(math.MinInt8), ""},
		{int8(math.MaxInt8), int8(math.MaxInt8), ""},

		// In-range ints.
		{int(math.MinInt8), int8(math.MinInt8), ""},
		{int(math.MaxInt8), int8(math.MaxInt8), ""},

		// Out of range ints.
		{int(math.MinInt8 - 1), nil, "out of range"},
		{int(math.MaxInt8 + 1), nil, "out of range"},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Int16() {
	sig := reflect.TypeOf(func() int16 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{int16(math.MinInt16), int16(math.MinInt16), ""},
		{int16(math.MaxInt16), int16(math.MaxInt16), ""},

		// In-range ints.
		{int(math.MinInt16), int16(math.MinInt16), ""},
		{int(math.MaxInt16), int16(math.MaxInt16), ""},

		// Out of range ints.
		{int(math.MinInt16 - 1), nil, "out of range"},
		{int(math.MaxInt16 + 1), nil, "out of range"},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int8(1), nil, "given int8"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Int32() {
	sig := reflect.TypeOf(func() int32 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{int32(math.MinInt32), int32(math.MinInt32), ""},
		{int32(math.MaxInt32), int32(math.MaxInt32), ""},

		// Aliased version of type.
		{rune(17), int32(17), ""},

		// In-range ints.
		{int(math.MinInt32), int32(math.MinInt32), ""},
		{int(math.MaxInt32), int32(math.MaxInt32), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Rune() {
	sig := reflect.TypeOf(func() rune { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{rune(math.MinInt32), rune(math.MinInt32), ""},
		{rune(math.MaxInt32), rune(math.MaxInt32), ""},

		// Aliased version of type.
		{int32(17), rune(17), ""},

		// In-range ints.
		{int(math.MinInt32), rune(math.MinInt32), ""},
		{int(math.MaxInt32), rune(math.MaxInt32), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Int64() {
	sig := reflect.TypeOf(func() int64 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{int64(math.MinInt64), int64(math.MinInt64), ""},
		{int64(math.MaxInt64), int64(math.MaxInt64), ""},

		// In-range ints.
		{int(math.MinInt32), int64(math.MinInt32), ""},
		{int(math.MaxInt32), int64(math.MaxInt32), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Uint() {
	sig := reflect.TypeOf(func() uint { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{uint(0), uint(0), ""},
		{uint(math.MaxUint32), uint(math.MaxUint32), ""},

		// In-range ints.
		{int(0), uint(0), ""},
		{int(math.MaxInt32), uint(math.MaxInt32), ""},

		// Out of range ints.
		{int(-1), nil, "out of range"},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Uint8() {
	sig := reflect.TypeOf(func() uint8 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{uint8(0), uint8(0), ""},
		{uint8(math.MaxUint8), uint8(math.MaxUint8), ""},

		// Aliased version of type.
		{byte(17), uint8(17), ""},

		// In-range ints.
		{int(0), uint8(0), ""},
		{int(math.MaxUint8), uint8(math.MaxUint8), ""},

		// Out of range ints.
		{int(-1), nil, "out of range"},
		{int(math.MaxUint8 + 1), nil, "out of range"},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Byte() {
	sig := reflect.TypeOf(func() byte { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{byte(0), byte(0), ""},
		{byte(math.MaxUint8), byte(math.MaxUint8), ""},

		// Aliased version of type.
		{uint8(17), byte(17), ""},

		// In-range ints.
		{int(0), byte(0), ""},
		{int(math.MaxUint8), byte(math.MaxUint8), ""},

		// Out of range ints.
		{int(-1), nil, "out of range"},
		{int(math.MaxUint8 + 1), nil, "out of range"},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Uint16() {
	sig := reflect.TypeOf(func() uint16 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{uint16(0), uint16(0), ""},
		{uint16(math.MaxUint16), uint16(math.MaxUint16), ""},

		// In-range ints.
		{int(0), uint16(0), ""},
		{int(math.MaxUint16), uint16(math.MaxUint16), ""},

		// Out of range ints.
		{int(-1), nil, "out of range"},
		{int(math.MaxUint16 + 1), nil, "out of range"},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Uint32() {
	sig := reflect.TypeOf(func() uint32 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{uint32(0), uint32(0), ""},
		{uint32(math.MaxUint32), uint32(math.MaxUint32), ""},

		// In-range ints.
		{int(0), uint32(0), ""},
		{int(math.MaxInt32), uint32(math.MaxInt32), ""},

		// Out of range ints.
		{int(-1), nil, "out of range"},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Uint64() {
	sig := reflect.TypeOf(func() uint64 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{uint64(0), uint64(0), ""},
		{uint64(math.MaxUint64), uint64(math.MaxUint64), ""},

		// In-range ints.
		{int(0), uint64(0), ""},
		{int(math.MaxInt32), uint64(math.MaxInt32), ""},

		// Out of range ints.
		{int(-1), nil, "out of range"},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Uintptr() {
	sig := reflect.TypeOf(func() uintptr { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{uintptr(17), uintptr(17), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Float32() {
	sig := reflect.TypeOf(func() float32 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{float32(-17.5), float32(-17.5), ""},
		{float32(17.5), float32(17.5), ""},

		// In-range ints.
		{int(-17), float32(-17), ""},
		{int(17), float32(17), ""},

		// Float64s
		{float64(-17.5), float32(-17.5), ""},
		{float64(17.5), float32(17.5), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Float64() {
	sig := reflect.TypeOf(func() float64 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{float64(-17.5), float64(-17.5), ""},
		{float64(17.5), float64(17.5), ""},

		// In-range ints.
		{int(-17), float64(-17), ""},
		{int(17), float64(17), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float32(1), nil, "given float32"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Complex64() {
	sig := reflect.TypeOf(func() complex64 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{complex64(-17.5 - 1i), complex64(-17.5 - 1i), ""},
		{complex64(17.5 + 1i), complex64(17.5 + 1i), ""},

		// In-range ints.
		{int(-17), complex64(-17), ""},
		{int(17), complex64(17), ""},

		// Float64s
		{float64(-17.5), complex64(-17.5), ""},
		{float64(17.5), complex64(17.5), ""},

		// Complex128s
		{complex128(-17.5 - 1i), complex64(-17.5 - 1i), ""},
		{complex128(17.5 + 1i), complex64(17.5 + 1i), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float32(1), nil, "given float32"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Complex128() {
	sig := reflect.TypeOf(func() complex128 { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{complex128(-17.5 - 1i), complex128(-17.5 - 1i), ""},
		{complex128(17.5 + 1i), complex128(17.5 + 1i), ""},

		// In-range ints.
		{int(-17), complex128(-17), ""},
		{int(17), complex128(17), ""},

		// Float64s
		{float64(-17.5), complex128(-17.5), ""},
		{float64(17.5), complex128(17.5), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float32(1), nil, "given float32"},
		{complex64(1), nil, "given complex64"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) ArrayOfInt() {
	type namedElemType int

	sig := reflect.TypeOf(func() [2]int { return [2]int{0, 0} })
	cases := []returnTestCase{
		// Identical types.
		{[2]int{19, 23}, [2]int{19, 23}, ""},

		// Wrong length.
		{[1]int{17}, nil, "given [1]int"},

		// Wrong element types.
		{[2]namedElemType{19, 23}, nil, "given [2]oglemock_test.namedElemType"},
		{[2]string{"", ""}, nil, "given [2]string"},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) ChanOfInt() {
	type namedElemType int
	someChan := make(chan int)

	sig := reflect.TypeOf(func() chan int { return nil })
	cases := []returnTestCase{
		// Identical types.
		{someChan, someChan, ""},

		// Nil values.
		{(interface{})(nil), (chan int)(nil), ""},
		{(chan int)(nil), (chan int)(nil), ""},

		// Wrong element types.
		{make(chan string), nil, "given chan string"},
		{make(chan namedElemType), nil, "given chan oglemock_test.namedElemType"},

		// Wrong direction
		{(<-chan int)(someChan), nil, "given <-chan int"},
		{(chan<- int)(someChan), nil, "given chan<- int"},

		// Wrong types.
		{(func())(nil), nil, "given func()"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) SendChanOfInt() {
	type namedElemType int

	someChan := make(chan<- int)
	someBidirectionalChannel := make(chan int)

	sig := reflect.TypeOf(func() chan<- int { return nil })
	cases := []returnTestCase{
		// Identical types.
		{someChan, someChan, ""},

		// Nil values.
		{(interface{})(nil), (chan<- int)(nil), ""},
		{(chan int)(nil), (chan<- int)(nil), ""},

		// Bidirectional channel
		{someBidirectionalChannel, (chan<- int)(someBidirectionalChannel), ""},

		// Wrong direction
		{(<-chan int)(someBidirectionalChannel), nil, "given <-chan int"},

		// Wrong element types.
		{make(chan string), nil, "given chan string"},
		{make(chan namedElemType), nil, "given chan oglemock_test.namedElemType"},

		// Wrong types.
		{(func())(nil), nil, "given func()"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) RecvChanOfInt() {
	type namedElemType int

	someChan := make(<-chan int)
	someBidirectionalChannel := make(chan int)

	sig := reflect.TypeOf(func() <-chan int { return nil })
	cases := []returnTestCase{
		// Identical types.
		{someChan, someChan, ""},

		// Nil values.
		{(interface{})(nil), (<-chan int)(nil), ""},
		{(chan int)(nil), (<-chan int)(nil), ""},

		// Bidirectional channel
		{someBidirectionalChannel, (<-chan int)(someBidirectionalChannel), ""},

		// Wrong direction
		{(chan<- int)(someBidirectionalChannel), nil, "given chan<- int"},

		// Wrong element types.
		{make(chan string), nil, "given chan string"},
		{make(chan namedElemType), nil, "given chan oglemock_test.namedElemType"},

		// Wrong types.
		{(func())(nil), nil, "given func()"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Func() {
	someFunc := func(string) int { return 0 }

	sig := reflect.TypeOf(func() func(string) int { return nil })
	cases := []returnTestCase{
		// Identical types.
		{someFunc, someFunc, ""},

		// Nil values.
		{(interface{})(nil), (func(string) int)(nil), ""},
		{(func(string) int)(nil), (func(string) int)(nil), ""},

		// Wrong parameter and return types.
		{func(int) int { return 0 }, nil, "given func(int) int"},
		{func(string) string { return "" }, nil, "given func(string) string"},

		// Wrong types.
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{(chan int)(nil), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Interface() {
	sig := reflect.TypeOf(func() io.Reader { return nil })

	someBuffer := new(bytes.Buffer)

	cases := []returnTestCase{
		// Type that implements interface.
		{someBuffer, someBuffer, ""},

		// Nil value.
		{(interface{})(nil), (interface{})(nil), ""},

		// Non-implementing types.
		{(chan int)(nil), nil, "given chan int"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) MapFromStringToInt() {
	type namedElemType string

	someMap := make(map[string]int)

	sig := reflect.TypeOf(func() map[string]int { return nil })
	cases := []returnTestCase{
		// Identical types.
		{someMap, someMap, ""},

		// Nil values.
		{(interface{})(nil), (map[string]int)(nil), ""},
		{(map[string]int)(nil), (map[string]int)(nil), ""},

		// Wrong element types.
		{make(map[int]int), nil, "given map[int]int"},
		{make(map[namedElemType]int), nil, "given map[oglemock_test.namedElemType]int"},
		{make(map[string]string), nil, "given map[string]string"},

		// Wrong types.
		{(func())(nil), nil, "given func()"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) PointerToString() {
	type namedElemType string

	someStr := ""

	sig := reflect.TypeOf(func() *string { return nil })
	cases := []returnTestCase{
		// Identical types.
		{(*string)(&someStr), (*string)(&someStr), ""},

		// Nil values.
		{(interface{})(nil), (*string)(nil), ""},
		{(*string)(nil), (*string)(nil), ""},

		// Wrong element types.
		{&someInt, nil, "given *int"},

		// Wrong types.
		{(func())(nil), nil, "given func()"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{unsafe.Pointer(&someStr), nil, "given unsafe.Pointer"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) SliceOfInts() {
	type namedElemType int

	someSlice := make([]int, 1)

	sig := reflect.TypeOf(func() []int { return nil })
	cases := []returnTestCase{
		// Identical types.
		{someSlice, someSlice, ""},

		// Nil values.
		{(interface{})(nil), ([]int)(nil), ""},
		{([]int)(nil), ([]int)(nil), ""},

		// Wrong element types.
		{make([]string, 1), nil, "given []string"},
		{make([]namedElemType, 1), nil, "given []oglemock_test.namedElemType"},

		// Wrong types.
		{(func())(nil), nil, "given func()"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) String() {
	sig := reflect.TypeOf(func() string { return "" })
	cases := []returnTestCase{
		// Identical types.
		{string(""), string(""), ""},
		{string("taco"), string("taco"), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) Struct() {
	type myStruct struct {
		a int
	}

	type otherStruct struct{}

	sig := reflect.TypeOf(func() myStruct { return myStruct{0} })
	cases := []returnTestCase{
		// Identical types.
		{myStruct{17}, myStruct{17}, ""},

		// Wrong field types.
		{otherStruct{}, nil, "given oglemock_test.otherStruct"},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) UnsafePointer() {
	someStr := ""

	sig := reflect.TypeOf(func() unsafe.Pointer { return nil })
	cases := []returnTestCase{
		// Identical types.
		{unsafe.Pointer(&someStr), unsafe.Pointer(&someStr), ""},

		// Nil values.
		{(interface{})(nil), unsafe.Pointer(nil), ""},
		{unsafe.Pointer(nil), unsafe.Pointer(nil), ""},

		// Wrong types.
		{(func())(nil), nil, "given func()"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{(*string)(&someStr), nil, "given *string"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) UserDefinedNumericType() {
	type myType int16

	sig := reflect.TypeOf(func() myType { return 0 })
	cases := []returnTestCase{
		// Identical types.
		{myType(math.MinInt16), myType(math.MinInt16), ""},
		{myType(math.MaxInt16), myType(math.MaxInt16), ""},

		// In-range ints.
		{int(math.MinInt16), myType(math.MinInt16), ""},
		{int(math.MaxInt16), myType(math.MaxInt16), ""},

		// Out of range ints.
		{int(math.MinInt16 - 1), nil, "out of range"},
		{int(math.MaxInt16 + 1), nil, "out of range"},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int16(1), nil, "given int16"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}

func (t *ReturnTest) UserDefinedNonNumericType() {
	type myType string

	sig := reflect.TypeOf(func() myType { return "" })
	cases := []returnTestCase{
		// Identical types.
		{myType("taco"), myType("taco"), ""},

		// Wrong types.
		{nil, nil, "given <nil>"},
		{int(1), nil, "given int"},
		{float64(1), nil, "given float64"},
		{complex128(1), nil, "given complex128"},
		{string(""), nil, "given string"},
		{&someInt, nil, "given *int"},
		{make(chan int), nil, "given chan int"},
	}

	t.runTestCases(sig, cases)
}
