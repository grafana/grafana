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

package oglematchers_test

import (
	"fmt"
	. "github.com/smartystreets/assertions/internal/oglematchers"
	. "github.com/smartystreets/assertions/internal/ogletest"
	"math"
	"unsafe"
)

var someInt int = -17

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type EqualsTest struct {
}

func init() { RegisterTestSuite(&EqualsTest{}) }

type equalsTestCase struct {
	candidate      interface{}
	expectedResult bool
	shouldBeFatal  bool
	expectedError  string
}

func (t *EqualsTest) checkTestCases(matcher Matcher, cases []equalsTestCase) {
	for i, c := range cases {
		err := matcher.Matches(c.candidate)
		ExpectEq(
			c.expectedResult,
			(err == nil),
			"Result for case %d: %v (Error: %v)", i, c, err)

		if err == nil {
			continue
		}

		_, isFatal := err.(*FatalError)
		ExpectEq(c.shouldBeFatal, isFatal, "Fatality for case %d: %v", i, c)

		ExpectThat(err, Error(Equals(c.expectedError)), "Case %d: %v", i, c)
	}
}

////////////////////////////////////////////////////////////////////////
// nil
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) EqualsNil() {
	matcher := Equals(nil)
	ExpectEq("is nil", matcher.Description())

	cases := []equalsTestCase{
		// Legal types
		equalsTestCase{nil, true, false, ""},
		equalsTestCase{chan int(nil), true, false, ""},
		equalsTestCase{(func())(nil), true, false, ""},
		equalsTestCase{interface{}(nil), true, false, ""},
		equalsTestCase{map[int]int(nil), true, false, ""},
		equalsTestCase{(*int)(nil), true, false, ""},
		equalsTestCase{[]int(nil), true, false, ""},

		equalsTestCase{make(chan int), false, false, ""},
		equalsTestCase{func() {}, false, false, ""},
		equalsTestCase{map[int]int{}, false, false, ""},
		equalsTestCase{&someInt, false, false, ""},
		equalsTestCase{[]int{}, false, false, ""},

		// Illegal types
		equalsTestCase{17, false, true, "which cannot be compared to nil"},
		equalsTestCase{int8(17), false, true, "which cannot be compared to nil"},
		equalsTestCase{uintptr(17), false, true, "which cannot be compared to nil"},
		equalsTestCase{[...]int{}, false, true, "which cannot be compared to nil"},
		equalsTestCase{"taco", false, true, "which cannot be compared to nil"},
		equalsTestCase{equalsTestCase{}, false, true, "which cannot be compared to nil"},
		equalsTestCase{unsafe.Pointer(&someInt), false, true, "which cannot be compared to nil"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// Integer literals
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NegativeIntegerLiteral() {
	// -2^30
	matcher := Equals(-1073741824)
	ExpectEq("-1073741824", matcher.Description())

	cases := []equalsTestCase{
		// Various types of -1073741824.
		equalsTestCase{-1073741824, true, false, ""},
		equalsTestCase{-1073741824.0, true, false, ""},
		equalsTestCase{-1073741824 + 0i, true, false, ""},
		equalsTestCase{int(-1073741824), true, false, ""},
		equalsTestCase{int32(-1073741824), true, false, ""},
		equalsTestCase{int64(-1073741824), true, false, ""},
		equalsTestCase{float32(-1073741824), true, false, ""},
		equalsTestCase{float64(-1073741824), true, false, ""},
		equalsTestCase{complex64(-1073741824), true, false, ""},
		equalsTestCase{complex128(-1073741824), true, false, ""},
		equalsTestCase{interface{}(int(-1073741824)), true, false, ""},

		// Values that would be -1073741824 in two's complement.
		equalsTestCase{uint((1 << 32) - 1073741824), false, false, ""},
		equalsTestCase{uint32((1 << 32) - 1073741824), false, false, ""},
		equalsTestCase{uint64((1 << 64) - 1073741824), false, false, ""},

		// Non-equal values of signed integer type.
		equalsTestCase{int(-1073741823), false, false, ""},
		equalsTestCase{int32(-1073741823), false, false, ""},
		equalsTestCase{int64(-1073741823), false, false, ""},

		// Non-equal values of other numeric types.
		equalsTestCase{float64(-1073741824.1), false, false, ""},
		equalsTestCase{float64(-1073741823.9), false, false, ""},
		equalsTestCase{complex128(-1073741823), false, false, ""},
		equalsTestCase{complex128(-1073741824 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveIntegerLiteral() {
	// 2^30
	matcher := Equals(1073741824)
	ExpectEq("1073741824", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 1073741824.
		equalsTestCase{1073741824, true, false, ""},
		equalsTestCase{1073741824.0, true, false, ""},
		equalsTestCase{1073741824 + 0i, true, false, ""},
		equalsTestCase{int(1073741824), true, false, ""},
		equalsTestCase{uint(1073741824), true, false, ""},
		equalsTestCase{int32(1073741824), true, false, ""},
		equalsTestCase{int64(1073741824), true, false, ""},
		equalsTestCase{uint32(1073741824), true, false, ""},
		equalsTestCase{uint64(1073741824), true, false, ""},
		equalsTestCase{float32(1073741824), true, false, ""},
		equalsTestCase{float64(1073741824), true, false, ""},
		equalsTestCase{complex64(1073741824), true, false, ""},
		equalsTestCase{complex128(1073741824), true, false, ""},
		equalsTestCase{interface{}(int(1073741824)), true, false, ""},
		equalsTestCase{interface{}(uint(1073741824)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(1073741823), false, false, ""},
		equalsTestCase{int32(1073741823), false, false, ""},
		equalsTestCase{int64(1073741823), false, false, ""},
		equalsTestCase{float64(1073741824.1), false, false, ""},
		equalsTestCase{float64(1073741823.9), false, false, ""},
		equalsTestCase{complex128(1073741823), false, false, ""},
		equalsTestCase{complex128(1073741824 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// Floating point literals
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NegativeIntegralFloatingPointLiteral() {
	// -2^30
	matcher := Equals(-1073741824.0)
	ExpectEq("-1.073741824e+09", matcher.Description())

	cases := []equalsTestCase{
		// Various types of -1073741824.
		equalsTestCase{-1073741824, true, false, ""},
		equalsTestCase{-1073741824.0, true, false, ""},
		equalsTestCase{-1073741824 + 0i, true, false, ""},
		equalsTestCase{int(-1073741824), true, false, ""},
		equalsTestCase{int32(-1073741824), true, false, ""},
		equalsTestCase{int64(-1073741824), true, false, ""},
		equalsTestCase{float32(-1073741824), true, false, ""},
		equalsTestCase{float64(-1073741824), true, false, ""},
		equalsTestCase{complex64(-1073741824), true, false, ""},
		equalsTestCase{complex128(-1073741824), true, false, ""},
		equalsTestCase{interface{}(int(-1073741824)), true, false, ""},
		equalsTestCase{interface{}(float64(-1073741824)), true, false, ""},

		// Values that would be -1073741824 in two's complement.
		equalsTestCase{uint((1 << 32) - 1073741824), false, false, ""},
		equalsTestCase{uint32((1 << 32) - 1073741824), false, false, ""},
		equalsTestCase{uint64((1 << 64) - 1073741824), false, false, ""},

		// Non-equal values of signed integer type.
		equalsTestCase{int(-1073741823), false, false, ""},
		equalsTestCase{int32(-1073741823), false, false, ""},
		equalsTestCase{int64(-1073741823), false, false, ""},

		// Non-equal values of other numeric types.
		equalsTestCase{float64(-1073741824.1), false, false, ""},
		equalsTestCase{float64(-1073741823.9), false, false, ""},
		equalsTestCase{complex128(-1073741823), false, false, ""},
		equalsTestCase{complex128(-1073741824 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveIntegralFloatingPointLiteral() {
	// 2^30
	matcher := Equals(1073741824.0)
	ExpectEq("1.073741824e+09", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 1073741824.
		equalsTestCase{1073741824, true, false, ""},
		equalsTestCase{1073741824.0, true, false, ""},
		equalsTestCase{1073741824 + 0i, true, false, ""},
		equalsTestCase{int(1073741824), true, false, ""},
		equalsTestCase{int32(1073741824), true, false, ""},
		equalsTestCase{int64(1073741824), true, false, ""},
		equalsTestCase{uint(1073741824), true, false, ""},
		equalsTestCase{uint32(1073741824), true, false, ""},
		equalsTestCase{uint64(1073741824), true, false, ""},
		equalsTestCase{float32(1073741824), true, false, ""},
		equalsTestCase{float64(1073741824), true, false, ""},
		equalsTestCase{complex64(1073741824), true, false, ""},
		equalsTestCase{complex128(1073741824), true, false, ""},
		equalsTestCase{interface{}(int(1073741824)), true, false, ""},
		equalsTestCase{interface{}(float64(1073741824)), true, false, ""},

		// Values that would be 1073741824 in two's complement.
		equalsTestCase{uint((1 << 32) - 1073741824), false, false, ""},
		equalsTestCase{uint32((1 << 32) - 1073741824), false, false, ""},
		equalsTestCase{uint64((1 << 64) - 1073741824), false, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(1073741823), false, false, ""},
		equalsTestCase{int32(1073741823), false, false, ""},
		equalsTestCase{int64(1073741823), false, false, ""},
		equalsTestCase{uint(1073741823), false, false, ""},
		equalsTestCase{uint32(1073741823), false, false, ""},
		equalsTestCase{uint64(1073741823), false, false, ""},
		equalsTestCase{float64(1073741824.1), false, false, ""},
		equalsTestCase{float64(1073741823.9), false, false, ""},
		equalsTestCase{complex128(1073741823), false, false, ""},
		equalsTestCase{complex128(1073741824 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) NonIntegralFloatingPointLiteral() {
	matcher := Equals(17.1)
	ExpectEq("17.1", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 17.1.
		equalsTestCase{17.1, true, false, ""},
		equalsTestCase{17.1, true, false, ""},
		equalsTestCase{17.1 + 0i, true, false, ""},
		equalsTestCase{float32(17.1), true, false, ""},
		equalsTestCase{float64(17.1), true, false, ""},
		equalsTestCase{complex64(17.1), true, false, ""},
		equalsTestCase{complex128(17.1), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{17, false, false, ""},
		equalsTestCase{17.2, false, false, ""},
		equalsTestCase{18, false, false, ""},
		equalsTestCase{int(17), false, false, ""},
		equalsTestCase{int(18), false, false, ""},
		equalsTestCase{int32(17), false, false, ""},
		equalsTestCase{int64(17), false, false, ""},
		equalsTestCase{uint(17), false, false, ""},
		equalsTestCase{uint32(17), false, false, ""},
		equalsTestCase{uint64(17), false, false, ""},
		equalsTestCase{complex128(17.1 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// bool
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) False() {
	matcher := Equals(false)
	ExpectEq("false", matcher.Description())

	cases := []equalsTestCase{
		// bools
		equalsTestCase{false, true, false, ""},
		equalsTestCase{bool(false), true, false, ""},

		equalsTestCase{true, false, false, ""},
		equalsTestCase{bool(true), false, false, ""},

		// Other types.
		equalsTestCase{int(0), false, true, "which is not a bool"},
		equalsTestCase{int8(0), false, true, "which is not a bool"},
		equalsTestCase{int16(0), false, true, "which is not a bool"},
		equalsTestCase{int32(0), false, true, "which is not a bool"},
		equalsTestCase{int64(0), false, true, "which is not a bool"},
		equalsTestCase{uint(0), false, true, "which is not a bool"},
		equalsTestCase{uint8(0), false, true, "which is not a bool"},
		equalsTestCase{uint16(0), false, true, "which is not a bool"},
		equalsTestCase{uint32(0), false, true, "which is not a bool"},
		equalsTestCase{uint64(0), false, true, "which is not a bool"},
		equalsTestCase{uintptr(0), false, true, "which is not a bool"},
		equalsTestCase{[...]int{}, false, true, "which is not a bool"},
		equalsTestCase{make(chan int), false, true, "which is not a bool"},
		equalsTestCase{func() {}, false, true, "which is not a bool"},
		equalsTestCase{map[int]int{}, false, true, "which is not a bool"},
		equalsTestCase{&someInt, false, true, "which is not a bool"},
		equalsTestCase{[]int{}, false, true, "which is not a bool"},
		equalsTestCase{"taco", false, true, "which is not a bool"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a bool"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) True() {
	matcher := Equals(true)
	ExpectEq("true", matcher.Description())

	cases := []equalsTestCase{
		// bools
		equalsTestCase{true, true, false, ""},
		equalsTestCase{bool(true), true, false, ""},

		equalsTestCase{false, false, false, ""},
		equalsTestCase{bool(false), false, false, ""},

		// Other types.
		equalsTestCase{int(1), false, true, "which is not a bool"},
		equalsTestCase{int8(1), false, true, "which is not a bool"},
		equalsTestCase{int16(1), false, true, "which is not a bool"},
		equalsTestCase{int32(1), false, true, "which is not a bool"},
		equalsTestCase{int64(1), false, true, "which is not a bool"},
		equalsTestCase{uint(1), false, true, "which is not a bool"},
		equalsTestCase{uint8(1), false, true, "which is not a bool"},
		equalsTestCase{uint16(1), false, true, "which is not a bool"},
		equalsTestCase{uint32(1), false, true, "which is not a bool"},
		equalsTestCase{uint64(1), false, true, "which is not a bool"},
		equalsTestCase{uintptr(1), false, true, "which is not a bool"},
		equalsTestCase{[...]int{}, false, true, "which is not a bool"},
		equalsTestCase{make(chan int), false, true, "which is not a bool"},
		equalsTestCase{func() {}, false, true, "which is not a bool"},
		equalsTestCase{map[int]int{}, false, true, "which is not a bool"},
		equalsTestCase{&someInt, false, true, "which is not a bool"},
		equalsTestCase{[]int{}, false, true, "which is not a bool"},
		equalsTestCase{"taco", false, true, "which is not a bool"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a bool"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// int
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NegativeInt() {
	// -2^30
	matcher := Equals(int(-1073741824))
	ExpectEq("-1073741824", matcher.Description())

	cases := []equalsTestCase{
		// Various types of -1073741824.
		equalsTestCase{-1073741824, true, false, ""},
		equalsTestCase{-1073741824.0, true, false, ""},
		equalsTestCase{-1073741824 + 0i, true, false, ""},
		equalsTestCase{int(-1073741824), true, false, ""},
		equalsTestCase{int32(-1073741824), true, false, ""},
		equalsTestCase{int64(-1073741824), true, false, ""},
		equalsTestCase{float32(-1073741824), true, false, ""},
		equalsTestCase{float64(-1073741824), true, false, ""},
		equalsTestCase{complex64(-1073741824), true, false, ""},
		equalsTestCase{complex128(-1073741824), true, false, ""},
		equalsTestCase{interface{}(int(-1073741824)), true, false, ""},

		// Values that would be -1073741824 in two's complement.
		equalsTestCase{uint((1 << 32) - 1073741824), false, false, ""},
		equalsTestCase{uint32((1 << 32) - 1073741824), false, false, ""},
		equalsTestCase{uint64((1 << 64) - 1073741824), false, false, ""},

		// Non-equal values of signed integer type.
		equalsTestCase{int(-1073741823), false, false, ""},
		equalsTestCase{int32(-1073741823), false, false, ""},
		equalsTestCase{int64(-1073741823), false, false, ""},

		// Non-equal values of other numeric types.
		equalsTestCase{float64(-1073741824.1), false, false, ""},
		equalsTestCase{float64(-1073741823.9), false, false, ""},
		equalsTestCase{complex128(-1073741823), false, false, ""},
		equalsTestCase{complex128(-1073741824 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveInt() {
	// 2^30
	matcher := Equals(int(1073741824))
	ExpectEq("1073741824", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 1073741824.
		equalsTestCase{1073741824, true, false, ""},
		equalsTestCase{1073741824.0, true, false, ""},
		equalsTestCase{1073741824 + 0i, true, false, ""},
		equalsTestCase{int(1073741824), true, false, ""},
		equalsTestCase{uint(1073741824), true, false, ""},
		equalsTestCase{int32(1073741824), true, false, ""},
		equalsTestCase{int64(1073741824), true, false, ""},
		equalsTestCase{uint32(1073741824), true, false, ""},
		equalsTestCase{uint64(1073741824), true, false, ""},
		equalsTestCase{float32(1073741824), true, false, ""},
		equalsTestCase{float64(1073741824), true, false, ""},
		equalsTestCase{complex64(1073741824), true, false, ""},
		equalsTestCase{complex128(1073741824), true, false, ""},
		equalsTestCase{interface{}(int(1073741824)), true, false, ""},
		equalsTestCase{interface{}(uint(1073741824)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(1073741823), false, false, ""},
		equalsTestCase{int32(1073741823), false, false, ""},
		equalsTestCase{int64(1073741823), false, false, ""},
		equalsTestCase{float64(1073741824.1), false, false, ""},
		equalsTestCase{float64(1073741823.9), false, false, ""},
		equalsTestCase{complex128(1073741823), false, false, ""},
		equalsTestCase{complex128(1073741824 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// int8
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NegativeInt8() {
	matcher := Equals(int8(-17))
	ExpectEq("-17", matcher.Description())

	cases := []equalsTestCase{
		// Various types of -17.
		equalsTestCase{-17, true, false, ""},
		equalsTestCase{-17.0, true, false, ""},
		equalsTestCase{-17 + 0i, true, false, ""},
		equalsTestCase{int(-17), true, false, ""},
		equalsTestCase{int8(-17), true, false, ""},
		equalsTestCase{int16(-17), true, false, ""},
		equalsTestCase{int32(-17), true, false, ""},
		equalsTestCase{int64(-17), true, false, ""},
		equalsTestCase{float32(-17), true, false, ""},
		equalsTestCase{float64(-17), true, false, ""},
		equalsTestCase{complex64(-17), true, false, ""},
		equalsTestCase{complex128(-17), true, false, ""},
		equalsTestCase{interface{}(int(-17)), true, false, ""},

		// Values that would be -17 in two's complement.
		equalsTestCase{uint((1 << 32) - 17), false, false, ""},
		equalsTestCase{uint8((1 << 8) - 17), false, false, ""},
		equalsTestCase{uint16((1 << 16) - 17), false, false, ""},
		equalsTestCase{uint32((1 << 32) - 17), false, false, ""},
		equalsTestCase{uint64((1 << 64) - 17), false, false, ""},

		// Non-equal values of signed integer type.
		equalsTestCase{int(-16), false, false, ""},
		equalsTestCase{int8(-16), false, false, ""},
		equalsTestCase{int16(-16), false, false, ""},
		equalsTestCase{int32(-16), false, false, ""},
		equalsTestCase{int64(-16), false, false, ""},

		// Non-equal values of other numeric types.
		equalsTestCase{float32(-17.1), false, false, ""},
		equalsTestCase{float32(-16.9), false, false, ""},
		equalsTestCase{complex64(-16), false, false, ""},
		equalsTestCase{complex64(-17 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr((1 << 32) - 17), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{-17}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{-17}, false, true, "which is not numeric"},
		equalsTestCase{"-17", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) ZeroInt8() {
	matcher := Equals(int8(0))
	ExpectEq("0", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 0.
		equalsTestCase{0, true, false, ""},
		equalsTestCase{0.0, true, false, ""},
		equalsTestCase{0 + 0i, true, false, ""},
		equalsTestCase{int(0), true, false, ""},
		equalsTestCase{int8(0), true, false, ""},
		equalsTestCase{int16(0), true, false, ""},
		equalsTestCase{int32(0), true, false, ""},
		equalsTestCase{int64(0), true, false, ""},
		equalsTestCase{float32(0), true, false, ""},
		equalsTestCase{float64(0), true, false, ""},
		equalsTestCase{complex64(0), true, false, ""},
		equalsTestCase{complex128(0), true, false, ""},
		equalsTestCase{interface{}(int(0)), true, false, ""},
		equalsTestCase{uint(0), true, false, ""},
		equalsTestCase{uint8(0), true, false, ""},
		equalsTestCase{uint16(0), true, false, ""},
		equalsTestCase{uint32(0), true, false, ""},
		equalsTestCase{uint64(0), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(1), false, false, ""},
		equalsTestCase{int8(1), false, false, ""},
		equalsTestCase{int16(1), false, false, ""},
		equalsTestCase{int32(1), false, false, ""},
		equalsTestCase{int64(1), false, false, ""},
		equalsTestCase{float32(-0.1), false, false, ""},
		equalsTestCase{float32(0.1), false, false, ""},
		equalsTestCase{complex64(1), false, false, ""},
		equalsTestCase{complex64(0 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{0}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{0}, false, true, "which is not numeric"},
		equalsTestCase{"0", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveInt8() {
	matcher := Equals(int8(17))
	ExpectEq("17", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 17.
		equalsTestCase{17, true, false, ""},
		equalsTestCase{17.0, true, false, ""},
		equalsTestCase{17 + 0i, true, false, ""},
		equalsTestCase{int(17), true, false, ""},
		equalsTestCase{int8(17), true, false, ""},
		equalsTestCase{int16(17), true, false, ""},
		equalsTestCase{int32(17), true, false, ""},
		equalsTestCase{int64(17), true, false, ""},
		equalsTestCase{float32(17), true, false, ""},
		equalsTestCase{float64(17), true, false, ""},
		equalsTestCase{complex64(17), true, false, ""},
		equalsTestCase{complex128(17), true, false, ""},
		equalsTestCase{interface{}(int(17)), true, false, ""},
		equalsTestCase{uint(17), true, false, ""},
		equalsTestCase{uint8(17), true, false, ""},
		equalsTestCase{uint16(17), true, false, ""},
		equalsTestCase{uint32(17), true, false, ""},
		equalsTestCase{uint64(17), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(16), false, false, ""},
		equalsTestCase{int8(16), false, false, ""},
		equalsTestCase{int16(16), false, false, ""},
		equalsTestCase{int32(16), false, false, ""},
		equalsTestCase{int64(16), false, false, ""},
		equalsTestCase{float32(16.9), false, false, ""},
		equalsTestCase{float32(17.1), false, false, ""},
		equalsTestCase{complex64(16), false, false, ""},
		equalsTestCase{complex64(17 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(17), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{17}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{17}, false, true, "which is not numeric"},
		equalsTestCase{"17", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// int16
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NegativeInt16() {
	matcher := Equals(int16(-32766))
	ExpectEq("-32766", matcher.Description())

	cases := []equalsTestCase{
		// Various types of -32766.
		equalsTestCase{-32766, true, false, ""},
		equalsTestCase{-32766.0, true, false, ""},
		equalsTestCase{-32766 + 0i, true, false, ""},
		equalsTestCase{int(-32766), true, false, ""},
		equalsTestCase{int16(-32766), true, false, ""},
		equalsTestCase{int32(-32766), true, false, ""},
		equalsTestCase{int64(-32766), true, false, ""},
		equalsTestCase{float32(-32766), true, false, ""},
		equalsTestCase{float64(-32766), true, false, ""},
		equalsTestCase{complex64(-32766), true, false, ""},
		equalsTestCase{complex128(-32766), true, false, ""},
		equalsTestCase{interface{}(int(-32766)), true, false, ""},

		// Values that would be -32766 in two's complement.
		equalsTestCase{uint((1 << 32) - 32766), false, false, ""},
		equalsTestCase{uint16((1 << 16) - 32766), false, false, ""},
		equalsTestCase{uint32((1 << 32) - 32766), false, false, ""},
		equalsTestCase{uint64((1 << 64) - 32766), false, false, ""},

		// Non-equal values of signed integer type.
		equalsTestCase{int(-16), false, false, ""},
		equalsTestCase{int8(-16), false, false, ""},
		equalsTestCase{int16(-16), false, false, ""},
		equalsTestCase{int32(-16), false, false, ""},
		equalsTestCase{int64(-16), false, false, ""},

		// Non-equal values of other numeric types.
		equalsTestCase{float32(-32766.1), false, false, ""},
		equalsTestCase{float32(-32765.9), false, false, ""},
		equalsTestCase{complex64(-32766.1), false, false, ""},
		equalsTestCase{complex64(-32766 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr((1 << 32) - 32766), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{-32766}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{-32766}, false, true, "which is not numeric"},
		equalsTestCase{"-32766", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) ZeroInt16() {
	matcher := Equals(int16(0))
	ExpectEq("0", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 0.
		equalsTestCase{0, true, false, ""},
		equalsTestCase{0.0, true, false, ""},
		equalsTestCase{0 + 0i, true, false, ""},
		equalsTestCase{int(0), true, false, ""},
		equalsTestCase{int8(0), true, false, ""},
		equalsTestCase{int16(0), true, false, ""},
		equalsTestCase{int32(0), true, false, ""},
		equalsTestCase{int64(0), true, false, ""},
		equalsTestCase{float32(0), true, false, ""},
		equalsTestCase{float64(0), true, false, ""},
		equalsTestCase{complex64(0), true, false, ""},
		equalsTestCase{complex128(0), true, false, ""},
		equalsTestCase{interface{}(int(0)), true, false, ""},
		equalsTestCase{uint(0), true, false, ""},
		equalsTestCase{uint8(0), true, false, ""},
		equalsTestCase{uint16(0), true, false, ""},
		equalsTestCase{uint32(0), true, false, ""},
		equalsTestCase{uint64(0), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(1), false, false, ""},
		equalsTestCase{int8(1), false, false, ""},
		equalsTestCase{int16(1), false, false, ""},
		equalsTestCase{int32(1), false, false, ""},
		equalsTestCase{int64(1), false, false, ""},
		equalsTestCase{float32(-0.1), false, false, ""},
		equalsTestCase{float32(0.1), false, false, ""},
		equalsTestCase{complex64(1), false, false, ""},
		equalsTestCase{complex64(0 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{0}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{0}, false, true, "which is not numeric"},
		equalsTestCase{"0", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveInt16() {
	matcher := Equals(int16(32765))
	ExpectEq("32765", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 32765.
		equalsTestCase{32765, true, false, ""},
		equalsTestCase{32765.0, true, false, ""},
		equalsTestCase{32765 + 0i, true, false, ""},
		equalsTestCase{int(32765), true, false, ""},
		equalsTestCase{int16(32765), true, false, ""},
		equalsTestCase{int32(32765), true, false, ""},
		equalsTestCase{int64(32765), true, false, ""},
		equalsTestCase{float32(32765), true, false, ""},
		equalsTestCase{float64(32765), true, false, ""},
		equalsTestCase{complex64(32765), true, false, ""},
		equalsTestCase{complex128(32765), true, false, ""},
		equalsTestCase{interface{}(int(32765)), true, false, ""},
		equalsTestCase{uint(32765), true, false, ""},
		equalsTestCase{uint16(32765), true, false, ""},
		equalsTestCase{uint32(32765), true, false, ""},
		equalsTestCase{uint64(32765), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(32764), false, false, ""},
		equalsTestCase{int16(32764), false, false, ""},
		equalsTestCase{int32(32764), false, false, ""},
		equalsTestCase{int64(32764), false, false, ""},
		equalsTestCase{float32(32764.9), false, false, ""},
		equalsTestCase{float32(32765.1), false, false, ""},
		equalsTestCase{complex64(32765.9), false, false, ""},
		equalsTestCase{complex64(32765 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(32765), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{32765}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{32765}, false, true, "which is not numeric"},
		equalsTestCase{"32765", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// int32
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NegativeInt32() {
	// -2^30
	matcher := Equals(int32(-1073741824))
	ExpectEq("-1073741824", matcher.Description())

	cases := []equalsTestCase{
		// Various types of -1073741824.
		equalsTestCase{-1073741824, true, false, ""},
		equalsTestCase{-1073741824.0, true, false, ""},
		equalsTestCase{-1073741824 + 0i, true, false, ""},
		equalsTestCase{int(-1073741824), true, false, ""},
		equalsTestCase{int32(-1073741824), true, false, ""},
		equalsTestCase{int64(-1073741824), true, false, ""},
		equalsTestCase{float32(-1073741824), true, false, ""},
		equalsTestCase{float64(-1073741824), true, false, ""},
		equalsTestCase{complex64(-1073741824), true, false, ""},
		equalsTestCase{complex128(-1073741824), true, false, ""},
		equalsTestCase{interface{}(int(-1073741824)), true, false, ""},

		// Values that would be -1073741824 in two's complement.
		equalsTestCase{uint((1 << 32) - 1073741824), false, false, ""},
		equalsTestCase{uint32((1 << 32) - 1073741824), false, false, ""},
		equalsTestCase{uint64((1 << 64) - 1073741824), false, false, ""},

		// Non-equal values of signed integer type.
		equalsTestCase{int(-1073741823), false, false, ""},
		equalsTestCase{int32(-1073741823), false, false, ""},
		equalsTestCase{int64(-1073741823), false, false, ""},

		// Non-equal values of other numeric types.
		equalsTestCase{float64(-1073741824.1), false, false, ""},
		equalsTestCase{float64(-1073741823.9), false, false, ""},
		equalsTestCase{complex128(-1073741823), false, false, ""},
		equalsTestCase{complex128(-1073741824 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveInt32() {
	// 2^30
	matcher := Equals(int32(1073741824))
	ExpectEq("1073741824", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 1073741824.
		equalsTestCase{1073741824, true, false, ""},
		equalsTestCase{1073741824.0, true, false, ""},
		equalsTestCase{1073741824 + 0i, true, false, ""},
		equalsTestCase{int(1073741824), true, false, ""},
		equalsTestCase{uint(1073741824), true, false, ""},
		equalsTestCase{int32(1073741824), true, false, ""},
		equalsTestCase{int64(1073741824), true, false, ""},
		equalsTestCase{uint32(1073741824), true, false, ""},
		equalsTestCase{uint64(1073741824), true, false, ""},
		equalsTestCase{float32(1073741824), true, false, ""},
		equalsTestCase{float64(1073741824), true, false, ""},
		equalsTestCase{complex64(1073741824), true, false, ""},
		equalsTestCase{complex128(1073741824), true, false, ""},
		equalsTestCase{interface{}(int(1073741824)), true, false, ""},
		equalsTestCase{interface{}(uint(1073741824)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(1073741823), false, false, ""},
		equalsTestCase{int32(1073741823), false, false, ""},
		equalsTestCase{int64(1073741823), false, false, ""},
		equalsTestCase{float64(1073741824.1), false, false, ""},
		equalsTestCase{float64(1073741823.9), false, false, ""},
		equalsTestCase{complex128(1073741823), false, false, ""},
		equalsTestCase{complex128(1073741824 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// int64
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NegativeInt64() {
	// -2^40
	matcher := Equals(int64(-1099511627776))
	ExpectEq("-1099511627776", matcher.Description())

	cases := []equalsTestCase{
		// Various types of -1099511627776.
		equalsTestCase{-1099511627776.0, true, false, ""},
		equalsTestCase{-1099511627776 + 0i, true, false, ""},
		equalsTestCase{int64(-1099511627776), true, false, ""},
		equalsTestCase{float32(-1099511627776), true, false, ""},
		equalsTestCase{float64(-1099511627776), true, false, ""},
		equalsTestCase{complex64(-1099511627776), true, false, ""},
		equalsTestCase{complex128(-1099511627776), true, false, ""},
		equalsTestCase{interface{}(int64(-1099511627776)), true, false, ""},

		// Values that would be -1099511627776 in two's complement.
		equalsTestCase{uint64((1 << 64) - 1099511627776), false, false, ""},

		// Non-equal values of signed integer type.
		equalsTestCase{int64(-1099511627775), false, false, ""},

		// Non-equal values of other numeric types.
		equalsTestCase{float64(-1099511627776.1), false, false, ""},
		equalsTestCase{float64(-1099511627775.9), false, false, ""},
		equalsTestCase{complex128(-1099511627775), false, false, ""},
		equalsTestCase{complex128(-1099511627776 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveInt64() {
	// 2^40
	matcher := Equals(int64(1099511627776))
	ExpectEq("1099511627776", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 1099511627776.
		equalsTestCase{1099511627776.0, true, false, ""},
		equalsTestCase{1099511627776 + 0i, true, false, ""},
		equalsTestCase{int64(1099511627776), true, false, ""},
		equalsTestCase{uint64(1099511627776), true, false, ""},
		equalsTestCase{float32(1099511627776), true, false, ""},
		equalsTestCase{float64(1099511627776), true, false, ""},
		equalsTestCase{complex64(1099511627776), true, false, ""},
		equalsTestCase{complex128(1099511627776), true, false, ""},
		equalsTestCase{interface{}(int64(1099511627776)), true, false, ""},
		equalsTestCase{interface{}(uint64(1099511627776)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(1099511627775), false, false, ""},
		equalsTestCase{uint64(1099511627775), false, false, ""},
		equalsTestCase{float64(1099511627776.1), false, false, ""},
		equalsTestCase{float64(1099511627775.9), false, false, ""},
		equalsTestCase{complex128(1099511627775), false, false, ""},
		equalsTestCase{complex128(1099511627776 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) Int64NotExactlyRepresentableBySinglePrecision() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := Equals(int64(kTwoTo25 + 1))
	ExpectEq("33554433", matcher.Description())

	cases := []equalsTestCase{
		// Integers.
		equalsTestCase{int64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{int64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 2), false, false, ""},

		equalsTestCase{uint64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 2), false, false, ""},

		// Single-precision floating point.
		equalsTestCase{float32(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{float32(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 3), false, false, ""},

		equalsTestCase{complex64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{complex64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 3), false, false, ""},

		// Double-precision floating point.
		equalsTestCase{float64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{float64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 2), false, false, ""},

		equalsTestCase{complex128(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 2), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) Int64NotExactlyRepresentableByDoublePrecision() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := Equals(int64(kTwoTo54 + 1))
	ExpectEq("18014398509481985", matcher.Description())

	cases := []equalsTestCase{
		// Integers.
		equalsTestCase{int64(kTwoTo54 + 0), false, false, ""},
		equalsTestCase{int64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{int64(kTwoTo54 + 2), false, false, ""},

		equalsTestCase{uint64(kTwoTo54 + 0), false, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 2), false, false, ""},

		// Double-precision floating point.
		equalsTestCase{float64(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{float64(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 3), false, false, ""},

		equalsTestCase{complex128(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{complex128(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// uint
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) SmallUint() {
	const kExpected = 17
	matcher := Equals(uint(kExpected))
	ExpectEq("17", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{17, true, false, ""},
		equalsTestCase{17.0, true, false, ""},
		equalsTestCase{17 + 0i, true, false, ""},
		equalsTestCase{int(kExpected), true, false, ""},
		equalsTestCase{int8(kExpected), true, false, ""},
		equalsTestCase{int16(kExpected), true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint(kExpected), true, false, ""},
		equalsTestCase{uint8(kExpected), true, false, ""},
		equalsTestCase{uint16(kExpected), true, false, ""},
		equalsTestCase{uint32(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric types.
		equalsTestCase{kExpected + 1, false, false, ""},
		equalsTestCase{int(kExpected + 1), false, false, ""},
		equalsTestCase{int8(kExpected + 1), false, false, ""},
		equalsTestCase{int16(kExpected + 1), false, false, ""},
		equalsTestCase{int32(kExpected + 1), false, false, ""},
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint(kExpected + 1), false, false, ""},
		equalsTestCase{uint8(kExpected + 1), false, false, ""},
		equalsTestCase{uint16(kExpected + 1), false, false, ""},
		equalsTestCase{uint32(kExpected + 1), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float32(kExpected + 1), false, false, ""},
		equalsTestCase{float64(kExpected + 1), false, false, ""},
		equalsTestCase{complex64(kExpected + 2i), false, false, ""},
		equalsTestCase{complex64(kExpected + 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected + 1), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargeUint() {
	const kExpected = (1 << 16) + 17
	matcher := Equals(uint(kExpected))
	ExpectEq("65553", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{65553, true, false, ""},
		equalsTestCase{65553.0, true, false, ""},
		equalsTestCase{65553 + 0i, true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint32(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric types.
		equalsTestCase{int16(17), false, false, ""},
		equalsTestCase{int32(kExpected + 1), false, false, ""},
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint16(17), false, false, ""},
		equalsTestCase{uint32(kExpected + 1), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float64(kExpected + 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected + 1), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) UintNotExactlyRepresentableBySinglePrecision() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := Equals(uint(kTwoTo25 + 1))
	ExpectEq("33554433", matcher.Description())

	cases := []equalsTestCase{
		// Integers.
		equalsTestCase{int64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{int64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 2), false, false, ""},

		equalsTestCase{uint64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 2), false, false, ""},

		// Single-precision floating point.
		equalsTestCase{float32(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{float32(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 3), false, false, ""},

		equalsTestCase{complex64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{complex64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 3), false, false, ""},

		// Double-precision floating point.
		equalsTestCase{float64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{float64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 2), false, false, ""},

		equalsTestCase{complex128(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 2), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// uint8
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) SmallUint8() {
	const kExpected = 17
	matcher := Equals(uint8(kExpected))
	ExpectEq("17", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{17, true, false, ""},
		equalsTestCase{17.0, true, false, ""},
		equalsTestCase{17 + 0i, true, false, ""},
		equalsTestCase{int(kExpected), true, false, ""},
		equalsTestCase{int8(kExpected), true, false, ""},
		equalsTestCase{int16(kExpected), true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint(kExpected), true, false, ""},
		equalsTestCase{uint8(kExpected), true, false, ""},
		equalsTestCase{uint16(kExpected), true, false, ""},
		equalsTestCase{uint32(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric types.
		equalsTestCase{kExpected + 1, false, false, ""},
		equalsTestCase{int(kExpected + 1), false, false, ""},
		equalsTestCase{int8(kExpected + 1), false, false, ""},
		equalsTestCase{int16(kExpected + 1), false, false, ""},
		equalsTestCase{int32(kExpected + 1), false, false, ""},
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint(kExpected + 1), false, false, ""},
		equalsTestCase{uint8(kExpected + 1), false, false, ""},
		equalsTestCase{uint16(kExpected + 1), false, false, ""},
		equalsTestCase{uint32(kExpected + 1), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float32(kExpected + 1), false, false, ""},
		equalsTestCase{float64(kExpected + 1), false, false, ""},
		equalsTestCase{complex64(kExpected + 2i), false, false, ""},
		equalsTestCase{complex64(kExpected + 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected + 1), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// uint16
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) SmallUint16() {
	const kExpected = 17
	matcher := Equals(uint16(kExpected))
	ExpectEq("17", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{17, true, false, ""},
		equalsTestCase{17.0, true, false, ""},
		equalsTestCase{17 + 0i, true, false, ""},
		equalsTestCase{int(kExpected), true, false, ""},
		equalsTestCase{int8(kExpected), true, false, ""},
		equalsTestCase{int16(kExpected), true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint(kExpected), true, false, ""},
		equalsTestCase{uint8(kExpected), true, false, ""},
		equalsTestCase{uint16(kExpected), true, false, ""},
		equalsTestCase{uint32(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric types.
		equalsTestCase{kExpected + 1, false, false, ""},
		equalsTestCase{int(kExpected + 1), false, false, ""},
		equalsTestCase{int8(kExpected + 1), false, false, ""},
		equalsTestCase{int16(kExpected + 1), false, false, ""},
		equalsTestCase{int32(kExpected + 1), false, false, ""},
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint(kExpected + 1), false, false, ""},
		equalsTestCase{uint8(kExpected + 1), false, false, ""},
		equalsTestCase{uint16(kExpected + 1), false, false, ""},
		equalsTestCase{uint32(kExpected + 1), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float32(kExpected + 1), false, false, ""},
		equalsTestCase{float64(kExpected + 1), false, false, ""},
		equalsTestCase{complex64(kExpected + 2i), false, false, ""},
		equalsTestCase{complex64(kExpected + 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected + 1), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargeUint16() {
	const kExpected = (1 << 8) + 17
	matcher := Equals(uint16(kExpected))
	ExpectEq("273", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{273, true, false, ""},
		equalsTestCase{273.0, true, false, ""},
		equalsTestCase{273 + 0i, true, false, ""},
		equalsTestCase{int16(kExpected), true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint16(kExpected), true, false, ""},
		equalsTestCase{uint32(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric types.
		equalsTestCase{int8(17), false, false, ""},
		equalsTestCase{int16(kExpected + 1), false, false, ""},
		equalsTestCase{int32(kExpected + 1), false, false, ""},
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint8(17), false, false, ""},
		equalsTestCase{uint16(kExpected + 1), false, false, ""},
		equalsTestCase{uint32(kExpected + 1), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float64(kExpected + 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected + 1), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// uint32
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) SmallUint32() {
	const kExpected = 17
	matcher := Equals(uint32(kExpected))
	ExpectEq("17", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{17, true, false, ""},
		equalsTestCase{17.0, true, false, ""},
		equalsTestCase{17 + 0i, true, false, ""},
		equalsTestCase{int(kExpected), true, false, ""},
		equalsTestCase{int8(kExpected), true, false, ""},
		equalsTestCase{int16(kExpected), true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint(kExpected), true, false, ""},
		equalsTestCase{uint8(kExpected), true, false, ""},
		equalsTestCase{uint16(kExpected), true, false, ""},
		equalsTestCase{uint32(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric types.
		equalsTestCase{kExpected + 1, false, false, ""},
		equalsTestCase{int(kExpected + 1), false, false, ""},
		equalsTestCase{int8(kExpected + 1), false, false, ""},
		equalsTestCase{int16(kExpected + 1), false, false, ""},
		equalsTestCase{int32(kExpected + 1), false, false, ""},
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint(kExpected + 1), false, false, ""},
		equalsTestCase{uint8(kExpected + 1), false, false, ""},
		equalsTestCase{uint16(kExpected + 1), false, false, ""},
		equalsTestCase{uint32(kExpected + 1), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float32(kExpected + 1), false, false, ""},
		equalsTestCase{float64(kExpected + 1), false, false, ""},
		equalsTestCase{complex64(kExpected + 2i), false, false, ""},
		equalsTestCase{complex64(kExpected + 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected + 1), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargeUint32() {
	const kExpected = (1 << 16) + 17
	matcher := Equals(uint32(kExpected))
	ExpectEq("65553", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{65553, true, false, ""},
		equalsTestCase{65553.0, true, false, ""},
		equalsTestCase{65553 + 0i, true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint32(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric types.
		equalsTestCase{int16(17), false, false, ""},
		equalsTestCase{int32(kExpected + 1), false, false, ""},
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint16(17), false, false, ""},
		equalsTestCase{uint32(kExpected + 1), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float64(kExpected + 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected + 1), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) Uint32NotExactlyRepresentableBySinglePrecision() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := Equals(uint32(kTwoTo25 + 1))
	ExpectEq("33554433", matcher.Description())

	cases := []equalsTestCase{
		// Integers.
		equalsTestCase{int64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{int64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 2), false, false, ""},

		equalsTestCase{uint64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 2), false, false, ""},

		// Single-precision floating point.
		equalsTestCase{float32(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{float32(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 3), false, false, ""},

		equalsTestCase{complex64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{complex64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 3), false, false, ""},

		// Double-precision floating point.
		equalsTestCase{float64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{float64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 2), false, false, ""},

		equalsTestCase{complex128(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 2), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// uint64
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) SmallUint64() {
	const kExpected = 17
	matcher := Equals(uint64(kExpected))
	ExpectEq("17", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{17, true, false, ""},
		equalsTestCase{17.0, true, false, ""},
		equalsTestCase{17 + 0i, true, false, ""},
		equalsTestCase{int(kExpected), true, false, ""},
		equalsTestCase{int8(kExpected), true, false, ""},
		equalsTestCase{int16(kExpected), true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint(kExpected), true, false, ""},
		equalsTestCase{uint8(kExpected), true, false, ""},
		equalsTestCase{uint16(kExpected), true, false, ""},
		equalsTestCase{uint32(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric types.
		equalsTestCase{kExpected + 1, false, false, ""},
		equalsTestCase{int(kExpected + 1), false, false, ""},
		equalsTestCase{int8(kExpected + 1), false, false, ""},
		equalsTestCase{int16(kExpected + 1), false, false, ""},
		equalsTestCase{int32(kExpected + 1), false, false, ""},
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint(kExpected + 1), false, false, ""},
		equalsTestCase{uint8(kExpected + 1), false, false, ""},
		equalsTestCase{uint16(kExpected + 1), false, false, ""},
		equalsTestCase{uint32(kExpected + 1), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float32(kExpected + 1), false, false, ""},
		equalsTestCase{float64(kExpected + 1), false, false, ""},
		equalsTestCase{complex64(kExpected + 2i), false, false, ""},
		equalsTestCase{complex64(kExpected + 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected + 1), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargeUint64() {
	const kExpected = (1 << 32) + 17
	matcher := Equals(uint64(kExpected))
	ExpectEq("4294967313", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{4294967313.0, true, false, ""},
		equalsTestCase{4294967313 + 0i, true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric types.
		equalsTestCase{int(17), false, false, ""},
		equalsTestCase{int32(17), false, false, ""},
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint(17), false, false, ""},
		equalsTestCase{uint32(17), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float64(kExpected + 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected + 1), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) Uint64NotExactlyRepresentableBySinglePrecision() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := Equals(uint64(kTwoTo25 + 1))
	ExpectEq("33554433", matcher.Description())

	cases := []equalsTestCase{
		// Integers.
		equalsTestCase{int64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{int64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 2), false, false, ""},

		equalsTestCase{uint64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 2), false, false, ""},

		// Single-precision floating point.
		equalsTestCase{float32(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{float32(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 3), false, false, ""},

		equalsTestCase{complex64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{complex64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 3), false, false, ""},

		// Double-precision floating point.
		equalsTestCase{float64(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{float64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 2), false, false, ""},

		equalsTestCase{complex128(kTwoTo25 + 0), false, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 2), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) Uint64NotExactlyRepresentableByDoublePrecision() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := Equals(uint64(kTwoTo54 + 1))
	ExpectEq("18014398509481985", matcher.Description())

	cases := []equalsTestCase{
		// Integers.
		equalsTestCase{int64(kTwoTo54 + 0), false, false, ""},
		equalsTestCase{int64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{int64(kTwoTo54 + 2), false, false, ""},

		equalsTestCase{uint64(kTwoTo54 + 0), false, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 2), false, false, ""},

		// Double-precision floating point.
		equalsTestCase{float64(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{float64(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 3), false, false, ""},

		equalsTestCase{complex128(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{complex128(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// uintptr
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NilUintptr() {
	var ptr1 uintptr
	var ptr2 uintptr

	matcher := Equals(ptr1)
	ExpectEq("0", matcher.Description())

	cases := []equalsTestCase{
		// uintptrs
		equalsTestCase{ptr1, true, false, ""},
		equalsTestCase{ptr2, true, false, ""},
		equalsTestCase{uintptr(0), true, false, ""},
		equalsTestCase{uintptr(17), false, false, ""},

		// Other types.
		equalsTestCase{0, false, true, "which is not a uintptr"},
		equalsTestCase{bool(false), false, true, "which is not a uintptr"},
		equalsTestCase{int(0), false, true, "which is not a uintptr"},
		equalsTestCase{int8(0), false, true, "which is not a uintptr"},
		equalsTestCase{int16(0), false, true, "which is not a uintptr"},
		equalsTestCase{int32(0), false, true, "which is not a uintptr"},
		equalsTestCase{int64(0), false, true, "which is not a uintptr"},
		equalsTestCase{uint(0), false, true, "which is not a uintptr"},
		equalsTestCase{uint8(0), false, true, "which is not a uintptr"},
		equalsTestCase{uint16(0), false, true, "which is not a uintptr"},
		equalsTestCase{uint32(0), false, true, "which is not a uintptr"},
		equalsTestCase{uint64(0), false, true, "which is not a uintptr"},
		equalsTestCase{true, false, true, "which is not a uintptr"},
		equalsTestCase{[...]int{}, false, true, "which is not a uintptr"},
		equalsTestCase{make(chan int), false, true, "which is not a uintptr"},
		equalsTestCase{func() {}, false, true, "which is not a uintptr"},
		equalsTestCase{map[int]int{}, false, true, "which is not a uintptr"},
		equalsTestCase{&someInt, false, true, "which is not a uintptr"},
		equalsTestCase{[]int{}, false, true, "which is not a uintptr"},
		equalsTestCase{"taco", false, true, "which is not a uintptr"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a uintptr"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) NonNilUintptr() {
	matcher := Equals(uintptr(17))
	ExpectEq("17", matcher.Description())

	cases := []equalsTestCase{
		// uintptrs
		equalsTestCase{uintptr(17), true, false, ""},
		equalsTestCase{uintptr(16), false, false, ""},
		equalsTestCase{uintptr(0), false, false, ""},

		// Other types.
		equalsTestCase{0, false, true, "which is not a uintptr"},
		equalsTestCase{bool(false), false, true, "which is not a uintptr"},
		equalsTestCase{int(0), false, true, "which is not a uintptr"},
		equalsTestCase{int8(0), false, true, "which is not a uintptr"},
		equalsTestCase{int16(0), false, true, "which is not a uintptr"},
		equalsTestCase{int32(0), false, true, "which is not a uintptr"},
		equalsTestCase{int64(0), false, true, "which is not a uintptr"},
		equalsTestCase{uint(0), false, true, "which is not a uintptr"},
		equalsTestCase{uint8(0), false, true, "which is not a uintptr"},
		equalsTestCase{uint16(0), false, true, "which is not a uintptr"},
		equalsTestCase{uint32(0), false, true, "which is not a uintptr"},
		equalsTestCase{uint64(0), false, true, "which is not a uintptr"},
		equalsTestCase{true, false, true, "which is not a uintptr"},
		equalsTestCase{[...]int{}, false, true, "which is not a uintptr"},
		equalsTestCase{make(chan int), false, true, "which is not a uintptr"},
		equalsTestCase{func() {}, false, true, "which is not a uintptr"},
		equalsTestCase{map[int]int{}, false, true, "which is not a uintptr"},
		equalsTestCase{&someInt, false, true, "which is not a uintptr"},
		equalsTestCase{[]int{}, false, true, "which is not a uintptr"},
		equalsTestCase{"taco", false, true, "which is not a uintptr"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a uintptr"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// float32
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NegativeIntegralFloat32() {
	matcher := Equals(float32(-32769))
	ExpectEq("-32769", matcher.Description())

	cases := []equalsTestCase{
		// Various types of -32769.
		equalsTestCase{-32769.0, true, false, ""},
		equalsTestCase{-32769 + 0i, true, false, ""},
		equalsTestCase{int32(-32769), true, false, ""},
		equalsTestCase{int64(-32769), true, false, ""},
		equalsTestCase{float32(-32769), true, false, ""},
		equalsTestCase{float64(-32769), true, false, ""},
		equalsTestCase{complex64(-32769), true, false, ""},
		equalsTestCase{complex128(-32769), true, false, ""},
		equalsTestCase{interface{}(float32(-32769)), true, false, ""},
		equalsTestCase{interface{}(int64(-32769)), true, false, ""},

		// Values that would be -32769 in two's complement.
		equalsTestCase{uint64((1 << 64) - 32769), false, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(-32770), false, false, ""},
		equalsTestCase{float32(-32769.1), false, false, ""},
		equalsTestCase{float32(-32768.9), false, false, ""},
		equalsTestCase{float64(-32769.1), false, false, ""},
		equalsTestCase{float64(-32768.9), false, false, ""},
		equalsTestCase{complex128(-32768), false, false, ""},
		equalsTestCase{complex128(-32769 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) NegativeNonIntegralFloat32() {
	matcher := Equals(float32(-32769.1))
	ExpectEq("-32769.1", matcher.Description())

	cases := []equalsTestCase{
		// Various types of -32769.1.
		equalsTestCase{-32769.1, true, false, ""},
		equalsTestCase{-32769.1 + 0i, true, false, ""},
		equalsTestCase{float32(-32769.1), true, false, ""},
		equalsTestCase{float64(-32769.1), true, false, ""},
		equalsTestCase{complex64(-32769.1), true, false, ""},
		equalsTestCase{complex128(-32769.1), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int32(-32769), false, false, ""},
		equalsTestCase{int32(-32770), false, false, ""},
		equalsTestCase{int64(-32769), false, false, ""},
		equalsTestCase{int64(-32770), false, false, ""},
		equalsTestCase{float32(-32769.2), false, false, ""},
		equalsTestCase{float32(-32769.0), false, false, ""},
		equalsTestCase{float64(-32769.2), false, false, ""},
		equalsTestCase{complex128(-32769.1 + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargeNegativeFloat32() {
	const kExpected = -1 * (1 << 65)
	matcher := Equals(float32(kExpected))
	ExpectEq("-3.689349e+19", matcher.Description())

	floatExpected := float32(kExpected)
	castedInt := int64(floatExpected)

	cases := []equalsTestCase{
		// Equal values of numeric type.
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{castedInt, false, false, ""},
		equalsTestCase{int64(0), false, false, ""},
		equalsTestCase{int64(math.MinInt64), false, false, ""},
		equalsTestCase{int64(math.MaxInt64), false, false, ""},
		equalsTestCase{float32(kExpected / 2), false, false, ""},
		equalsTestCase{float64(kExpected / 2), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) ZeroFloat32() {
	matcher := Equals(float32(0))
	ExpectEq("0", matcher.Description())

	cases := []equalsTestCase{
		// Various types of zero.
		equalsTestCase{0.0, true, false, ""},
		equalsTestCase{0 + 0i, true, false, ""},
		equalsTestCase{int(0), true, false, ""},
		equalsTestCase{int8(0), true, false, ""},
		equalsTestCase{int16(0), true, false, ""},
		equalsTestCase{int32(0), true, false, ""},
		equalsTestCase{int64(0), true, false, ""},
		equalsTestCase{uint(0), true, false, ""},
		equalsTestCase{uint8(0), true, false, ""},
		equalsTestCase{uint16(0), true, false, ""},
		equalsTestCase{uint32(0), true, false, ""},
		equalsTestCase{uint64(0), true, false, ""},
		equalsTestCase{float32(0), true, false, ""},
		equalsTestCase{float64(0), true, false, ""},
		equalsTestCase{complex64(0), true, false, ""},
		equalsTestCase{complex128(0), true, false, ""},
		equalsTestCase{interface{}(float32(0)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(1), false, false, ""},
		equalsTestCase{int64(-1), false, false, ""},
		equalsTestCase{float32(1), false, false, ""},
		equalsTestCase{float32(-1), false, false, ""},
		equalsTestCase{complex128(0 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveIntegralFloat32() {
	matcher := Equals(float32(32769))
	ExpectEq("32769", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 32769.
		equalsTestCase{32769.0, true, false, ""},
		equalsTestCase{32769 + 0i, true, false, ""},
		equalsTestCase{int(32769), true, false, ""},
		equalsTestCase{int32(32769), true, false, ""},
		equalsTestCase{int64(32769), true, false, ""},
		equalsTestCase{uint(32769), true, false, ""},
		equalsTestCase{uint32(32769), true, false, ""},
		equalsTestCase{uint64(32769), true, false, ""},
		equalsTestCase{float32(32769), true, false, ""},
		equalsTestCase{float64(32769), true, false, ""},
		equalsTestCase{complex64(32769), true, false, ""},
		equalsTestCase{complex128(32769), true, false, ""},
		equalsTestCase{interface{}(float32(32769)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(32770), false, false, ""},
		equalsTestCase{uint64(32770), false, false, ""},
		equalsTestCase{float32(32769.1), false, false, ""},
		equalsTestCase{float32(32768.9), false, false, ""},
		equalsTestCase{float64(32769.1), false, false, ""},
		equalsTestCase{float64(32768.9), false, false, ""},
		equalsTestCase{complex128(32768), false, false, ""},
		equalsTestCase{complex128(32769 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveNonIntegralFloat32() {
	matcher := Equals(float32(32769.1))
	ExpectEq("32769.1", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 32769.1.
		equalsTestCase{32769.1, true, false, ""},
		equalsTestCase{32769.1 + 0i, true, false, ""},
		equalsTestCase{float32(32769.1), true, false, ""},
		equalsTestCase{float64(32769.1), true, false, ""},
		equalsTestCase{complex64(32769.1), true, false, ""},
		equalsTestCase{complex128(32769.1), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int32(32769), false, false, ""},
		equalsTestCase{int32(32770), false, false, ""},
		equalsTestCase{uint64(32769), false, false, ""},
		equalsTestCase{uint64(32770), false, false, ""},
		equalsTestCase{float32(32769.2), false, false, ""},
		equalsTestCase{float32(32769.0), false, false, ""},
		equalsTestCase{float64(32769.2), false, false, ""},
		equalsTestCase{complex128(32769.1 + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargePositiveFloat32() {
	const kExpected = 1 << 65
	matcher := Equals(float32(kExpected))
	ExpectEq("3.689349e+19", matcher.Description())

	floatExpected := float32(kExpected)
	castedInt := uint64(floatExpected)

	cases := []equalsTestCase{
		// Equal values of numeric type.
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{castedInt, false, false, ""},
		equalsTestCase{int64(0), false, false, ""},
		equalsTestCase{int64(math.MinInt64), false, false, ""},
		equalsTestCase{int64(math.MaxInt64), false, false, ""},
		equalsTestCase{uint64(0), false, false, ""},
		equalsTestCase{uint64(math.MaxUint64), false, false, ""},
		equalsTestCase{float32(kExpected / 2), false, false, ""},
		equalsTestCase{float64(kExpected / 2), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) Float32AboveExactIntegerRange() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := Equals(float32(kTwoTo25 + 1))
	ExpectEq("3.3554432e+07", matcher.Description())

	cases := []equalsTestCase{
		// Integers.
		equalsTestCase{int64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{int64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 3), false, false, ""},

		equalsTestCase{uint64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{uint64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 3), false, false, ""},

		// Single-precision floating point.
		equalsTestCase{float32(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{float32(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 3), false, false, ""},

		equalsTestCase{complex64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{complex64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 3), false, false, ""},

		// Double-precision floating point.
		equalsTestCase{float64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{float64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 3), false, false, ""},

		equalsTestCase{complex128(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{complex128(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// float64
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NegativeIntegralFloat64() {
	const kExpected = -(1 << 50)
	matcher := Equals(float64(kExpected))
	ExpectEq("-1.125899906842624e+15", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{-1125899906842624.0, true, false, ""},
		equalsTestCase{-1125899906842624.0 + 0i, true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},
		equalsTestCase{interface{}(float64(kExpected)), true, false, ""},

		// Values that would be kExpected in two's complement.
		equalsTestCase{uint64((1 << 64) + kExpected), false, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{float32(kExpected - (1 << 30)), false, false, ""},
		equalsTestCase{float32(kExpected + (1 << 30)), false, false, ""},
		equalsTestCase{float64(kExpected - 0.5), false, false, ""},
		equalsTestCase{float64(kExpected + 0.5), false, false, ""},
		equalsTestCase{complex128(kExpected - 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) NegativeNonIntegralFloat64() {
	const kTwoTo50 = 1 << 50
	const kExpected = -kTwoTo50 - 0.25

	matcher := Equals(float64(kExpected))
	ExpectEq("-1.1258999068426242e+15", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{kExpected, true, false, ""},
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(-kTwoTo50), false, false, ""},
		equalsTestCase{int64(-kTwoTo50 - 1), false, false, ""},
		equalsTestCase{float32(kExpected - (1 << 30)), false, false, ""},
		equalsTestCase{float64(kExpected - 0.25), false, false, ""},
		equalsTestCase{float64(kExpected + 0.25), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargeNegativeFloat64() {
	const kExpected = -1 * (1 << 65)
	matcher := Equals(float64(kExpected))
	ExpectEq("-3.6893488147419103e+19", matcher.Description())

	floatExpected := float64(kExpected)
	castedInt := int64(floatExpected)

	cases := []equalsTestCase{
		// Equal values of numeric type.
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{castedInt, false, false, ""},
		equalsTestCase{int64(0), false, false, ""},
		equalsTestCase{int64(math.MinInt64), false, false, ""},
		equalsTestCase{int64(math.MaxInt64), false, false, ""},
		equalsTestCase{float32(kExpected / 2), false, false, ""},
		equalsTestCase{float64(kExpected / 2), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) ZeroFloat64() {
	matcher := Equals(float64(0))
	ExpectEq("0", matcher.Description())

	cases := []equalsTestCase{
		// Various types of zero.
		equalsTestCase{0.0, true, false, ""},
		equalsTestCase{0 + 0i, true, false, ""},
		equalsTestCase{int(0), true, false, ""},
		equalsTestCase{int8(0), true, false, ""},
		equalsTestCase{int16(0), true, false, ""},
		equalsTestCase{int32(0), true, false, ""},
		equalsTestCase{int64(0), true, false, ""},
		equalsTestCase{uint(0), true, false, ""},
		equalsTestCase{uint8(0), true, false, ""},
		equalsTestCase{uint16(0), true, false, ""},
		equalsTestCase{uint32(0), true, false, ""},
		equalsTestCase{uint64(0), true, false, ""},
		equalsTestCase{float32(0), true, false, ""},
		equalsTestCase{float64(0), true, false, ""},
		equalsTestCase{complex64(0), true, false, ""},
		equalsTestCase{complex128(0), true, false, ""},
		equalsTestCase{interface{}(float32(0)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(1), false, false, ""},
		equalsTestCase{int64(-1), false, false, ""},
		equalsTestCase{float32(1), false, false, ""},
		equalsTestCase{float32(-1), false, false, ""},
		equalsTestCase{complex128(0 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveIntegralFloat64() {
	const kExpected = 1 << 50
	matcher := Equals(float64(kExpected))
	ExpectEq("1.125899906842624e+15", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 32769.
		equalsTestCase{1125899906842624.0, true, false, ""},
		equalsTestCase{1125899906842624.0 + 0i, true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},
		equalsTestCase{interface{}(float64(kExpected)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float32(kExpected - (1 << 30)), false, false, ""},
		equalsTestCase{float32(kExpected + (1 << 30)), false, false, ""},
		equalsTestCase{float64(kExpected - 0.5), false, false, ""},
		equalsTestCase{float64(kExpected + 0.5), false, false, ""},
		equalsTestCase{complex128(kExpected - 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveNonIntegralFloat64() {
	const kTwoTo50 = 1 << 50
	const kExpected = kTwoTo50 + 0.25
	matcher := Equals(float64(kExpected))
	ExpectEq("1.1258999068426242e+15", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{kExpected, true, false, ""},
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(kTwoTo50), false, false, ""},
		equalsTestCase{int64(kTwoTo50 - 1), false, false, ""},
		equalsTestCase{float64(kExpected - 0.25), false, false, ""},
		equalsTestCase{float64(kExpected + 0.25), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargePositiveFloat64() {
	const kExpected = 1 << 65
	matcher := Equals(float64(kExpected))
	ExpectEq("3.6893488147419103e+19", matcher.Description())

	floatExpected := float64(kExpected)
	castedInt := uint64(floatExpected)

	cases := []equalsTestCase{
		// Equal values of numeric type.
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{castedInt, false, false, ""},
		equalsTestCase{int64(0), false, false, ""},
		equalsTestCase{int64(math.MinInt64), false, false, ""},
		equalsTestCase{int64(math.MaxInt64), false, false, ""},
		equalsTestCase{uint64(0), false, false, ""},
		equalsTestCase{uint64(math.MaxUint64), false, false, ""},
		equalsTestCase{float32(kExpected / 2), false, false, ""},
		equalsTestCase{float64(kExpected / 2), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) Float64AboveExactIntegerRange() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := Equals(float64(kTwoTo54 + 1))
	ExpectEq("1.8014398509481984e+16", matcher.Description())

	cases := []equalsTestCase{
		// Integers.
		equalsTestCase{int64(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{int64(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{int64(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{int64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{int64(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{int64(kTwoTo54 + 3), false, false, ""},

		equalsTestCase{uint64(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{uint64(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 3), false, false, ""},

		// Double-precision floating point.
		equalsTestCase{float64(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{float64(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 3), false, false, ""},

		equalsTestCase{complex128(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{complex128(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// complex64
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NegativeIntegralComplex64() {
	const kExpected = -32769
	matcher := Equals(complex64(kExpected))
	ExpectEq("(-32769+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{-32769.0, true, false, ""},
		equalsTestCase{-32769.0 + 0i, true, false, ""},
		equalsTestCase{int(kExpected), true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},
		equalsTestCase{interface{}(float64(kExpected)), true, false, ""},

		// Values that would be kExpected in two's complement.
		equalsTestCase{uint32((1 << 32) + kExpected), false, false, ""},
		equalsTestCase{uint64((1 << 64) + kExpected), false, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{float32(kExpected - (1 << 30)), false, false, ""},
		equalsTestCase{float32(kExpected + (1 << 30)), false, false, ""},
		equalsTestCase{float64(kExpected - 0.5), false, false, ""},
		equalsTestCase{float64(kExpected + 0.5), false, false, ""},
		equalsTestCase{complex64(kExpected - 1), false, false, ""},
		equalsTestCase{complex64(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected - 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) NegativeNonIntegralComplex64() {
	const kTwoTo20 = 1 << 20
	const kExpected = -kTwoTo20 - 0.25

	matcher := Equals(complex64(kExpected))
	ExpectEq("(-1.0485762e+06+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{kExpected, true, false, ""},
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(-kTwoTo20), false, false, ""},
		equalsTestCase{int(-kTwoTo20 - 1), false, false, ""},
		equalsTestCase{int32(-kTwoTo20), false, false, ""},
		equalsTestCase{int32(-kTwoTo20 - 1), false, false, ""},
		equalsTestCase{int64(-kTwoTo20), false, false, ""},
		equalsTestCase{int64(-kTwoTo20 - 1), false, false, ""},
		equalsTestCase{float32(kExpected - (1 << 30)), false, false, ""},
		equalsTestCase{float64(kExpected - 0.25), false, false, ""},
		equalsTestCase{float64(kExpected + 0.25), false, false, ""},
		equalsTestCase{complex64(kExpected - 0.75), false, false, ""},
		equalsTestCase{complex64(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected - 0.75), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargeNegativeComplex64() {
	const kExpected = -1 * (1 << 65)
	matcher := Equals(complex64(kExpected))
	ExpectEq("(-3.689349e+19+0i)", matcher.Description())

	floatExpected := float64(kExpected)
	castedInt := int64(floatExpected)

	cases := []equalsTestCase{
		// Equal values of numeric type.
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{castedInt, false, false, ""},
		equalsTestCase{int64(0), false, false, ""},
		equalsTestCase{int64(math.MinInt64), false, false, ""},
		equalsTestCase{int64(math.MaxInt64), false, false, ""},
		equalsTestCase{float32(kExpected / 2), false, false, ""},
		equalsTestCase{float64(kExpected / 2), false, false, ""},
		equalsTestCase{complex64(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) ZeroComplex64() {
	matcher := Equals(complex64(0))
	ExpectEq("(0+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of zero.
		equalsTestCase{0.0, true, false, ""},
		equalsTestCase{0 + 0i, true, false, ""},
		equalsTestCase{int(0), true, false, ""},
		equalsTestCase{int8(0), true, false, ""},
		equalsTestCase{int16(0), true, false, ""},
		equalsTestCase{int32(0), true, false, ""},
		equalsTestCase{int64(0), true, false, ""},
		equalsTestCase{uint(0), true, false, ""},
		equalsTestCase{uint8(0), true, false, ""},
		equalsTestCase{uint16(0), true, false, ""},
		equalsTestCase{uint32(0), true, false, ""},
		equalsTestCase{uint64(0), true, false, ""},
		equalsTestCase{float32(0), true, false, ""},
		equalsTestCase{float64(0), true, false, ""},
		equalsTestCase{complex64(0), true, false, ""},
		equalsTestCase{complex128(0), true, false, ""},
		equalsTestCase{interface{}(float32(0)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(1), false, false, ""},
		equalsTestCase{int64(-1), false, false, ""},
		equalsTestCase{float32(1), false, false, ""},
		equalsTestCase{float32(-1), false, false, ""},
		equalsTestCase{float64(1), false, false, ""},
		equalsTestCase{float64(-1), false, false, ""},
		equalsTestCase{complex64(0 + 2i), false, false, ""},
		equalsTestCase{complex128(0 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveIntegralComplex64() {
	const kExpected = 1 << 20
	matcher := Equals(complex64(kExpected))
	ExpectEq("(1.048576e+06+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 32769.
		equalsTestCase{1048576.0, true, false, ""},
		equalsTestCase{1048576.0 + 0i, true, false, ""},
		equalsTestCase{int(kExpected), true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint(kExpected), true, false, ""},
		equalsTestCase{uint32(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},
		equalsTestCase{interface{}(float64(kExpected)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(kExpected + 1), false, false, ""},
		equalsTestCase{int32(kExpected + 1), false, false, ""},
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint(kExpected + 1), false, false, ""},
		equalsTestCase{uint32(kExpected + 1), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float32(kExpected - (1 << 30)), false, false, ""},
		equalsTestCase{float32(kExpected + (1 << 30)), false, false, ""},
		equalsTestCase{float64(kExpected - 0.5), false, false, ""},
		equalsTestCase{float64(kExpected + 0.5), false, false, ""},
		equalsTestCase{complex128(kExpected - 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveNonIntegralComplex64() {
	const kTwoTo20 = 1 << 20
	const kExpected = kTwoTo20 + 0.25
	matcher := Equals(complex64(kExpected))
	ExpectEq("(1.0485762e+06+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{kExpected, true, false, ""},
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(kTwoTo20), false, false, ""},
		equalsTestCase{int64(kTwoTo20 - 1), false, false, ""},
		equalsTestCase{uint64(kTwoTo20), false, false, ""},
		equalsTestCase{uint64(kTwoTo20 - 1), false, false, ""},
		equalsTestCase{float32(kExpected - 1), false, false, ""},
		equalsTestCase{float32(kExpected + 1), false, false, ""},
		equalsTestCase{float64(kExpected - 0.25), false, false, ""},
		equalsTestCase{float64(kExpected + 0.25), false, false, ""},
		equalsTestCase{complex64(kExpected - 1), false, false, ""},
		equalsTestCase{complex64(kExpected - 1i), false, false, ""},
		equalsTestCase{complex128(kExpected - 1), false, false, ""},
		equalsTestCase{complex128(kExpected - 1i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargePositiveComplex64() {
	const kExpected = 1 << 65
	matcher := Equals(complex64(kExpected))
	ExpectEq("(3.689349e+19+0i)", matcher.Description())

	floatExpected := float64(kExpected)
	castedInt := uint64(floatExpected)

	cases := []equalsTestCase{
		// Equal values of numeric type.
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{castedInt, false, false, ""},
		equalsTestCase{int64(0), false, false, ""},
		equalsTestCase{int64(math.MinInt64), false, false, ""},
		equalsTestCase{int64(math.MaxInt64), false, false, ""},
		equalsTestCase{uint64(0), false, false, ""},
		equalsTestCase{uint64(math.MaxUint64), false, false, ""},
		equalsTestCase{float32(kExpected / 2), false, false, ""},
		equalsTestCase{float64(kExpected / 2), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) Complex64AboveExactIntegerRange() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := Equals(complex64(kTwoTo25 + 1))
	ExpectEq("(3.3554432e+07+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Integers.
		equalsTestCase{int64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{int64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{int64(kTwoTo25 + 3), false, false, ""},

		equalsTestCase{uint64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{uint64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{uint64(kTwoTo25 + 3), false, false, ""},

		// Single-precision floating point.
		equalsTestCase{float32(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{float32(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{float32(kTwoTo25 + 3), false, false, ""},

		equalsTestCase{complex64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{complex64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{complex64(kTwoTo25 + 3), false, false, ""},

		// Double-precision floating point.
		equalsTestCase{float64(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{float64(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{float64(kTwoTo25 + 3), false, false, ""},

		equalsTestCase{complex128(kTwoTo25 - 2), false, false, ""},
		equalsTestCase{complex128(kTwoTo25 - 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 0), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 2), true, false, ""},
		equalsTestCase{complex128(kTwoTo25 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) Complex64WithNonZeroImaginaryPart() {
	const kRealPart = 17
	const kImagPart = 0.25i
	const kExpected = kRealPart + kImagPart
	matcher := Equals(complex64(kExpected))
	ExpectEq("(17+0.25i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{kExpected, true, false, ""},
		equalsTestCase{kRealPart + kImagPart, true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(kRealPart), false, false, ""},
		equalsTestCase{int8(kRealPart), false, false, ""},
		equalsTestCase{int16(kRealPart), false, false, ""},
		equalsTestCase{int32(kRealPart), false, false, ""},
		equalsTestCase{int64(kRealPart), false, false, ""},
		equalsTestCase{uint(kRealPart), false, false, ""},
		equalsTestCase{uint8(kRealPart), false, false, ""},
		equalsTestCase{uint16(kRealPart), false, false, ""},
		equalsTestCase{uint32(kRealPart), false, false, ""},
		equalsTestCase{uint64(kRealPart), false, false, ""},
		equalsTestCase{float32(kRealPart), false, false, ""},
		equalsTestCase{float64(kRealPart), false, false, ""},
		equalsTestCase{complex64(kRealPart), false, false, ""},
		equalsTestCase{complex64(kRealPart + kImagPart + 0.5), false, false, ""},
		equalsTestCase{complex64(kRealPart + kImagPart + 0.5i), false, false, ""},
		equalsTestCase{complex128(kRealPart), false, false, ""},
		equalsTestCase{complex128(kRealPart + kImagPart + 0.5), false, false, ""},
		equalsTestCase{complex128(kRealPart + kImagPart + 0.5i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// complex128
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NegativeIntegralComplex128() {
	const kExpected = -32769
	matcher := Equals(complex128(kExpected))
	ExpectEq("(-32769+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{-32769.0, true, false, ""},
		equalsTestCase{-32769.0 + 0i, true, false, ""},
		equalsTestCase{int(kExpected), true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},
		equalsTestCase{interface{}(float64(kExpected)), true, false, ""},

		// Values that would be kExpected in two's complement.
		equalsTestCase{uint32((1 << 32) + kExpected), false, false, ""},
		equalsTestCase{uint64((1 << 64) + kExpected), false, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{float32(kExpected - (1 << 30)), false, false, ""},
		equalsTestCase{float32(kExpected + (1 << 30)), false, false, ""},
		equalsTestCase{float64(kExpected - 0.5), false, false, ""},
		equalsTestCase{float64(kExpected + 0.5), false, false, ""},
		equalsTestCase{complex64(kExpected - 1), false, false, ""},
		equalsTestCase{complex64(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected - 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) NegativeNonIntegralComplex128() {
	const kTwoTo20 = 1 << 20
	const kExpected = -kTwoTo20 - 0.25

	matcher := Equals(complex128(kExpected))
	ExpectEq("(-1.04857625e+06+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{kExpected, true, false, ""},
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(-kTwoTo20), false, false, ""},
		equalsTestCase{int(-kTwoTo20 - 1), false, false, ""},
		equalsTestCase{int32(-kTwoTo20), false, false, ""},
		equalsTestCase{int32(-kTwoTo20 - 1), false, false, ""},
		equalsTestCase{int64(-kTwoTo20), false, false, ""},
		equalsTestCase{int64(-kTwoTo20 - 1), false, false, ""},
		equalsTestCase{float32(kExpected - (1 << 30)), false, false, ""},
		equalsTestCase{float64(kExpected - 0.25), false, false, ""},
		equalsTestCase{float64(kExpected + 0.25), false, false, ""},
		equalsTestCase{complex64(kExpected - 0.75), false, false, ""},
		equalsTestCase{complex64(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected - 0.75), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargeNegativeComplex128() {
	const kExpected = -1 * (1 << 65)
	matcher := Equals(complex128(kExpected))
	ExpectEq("(-3.6893488147419103e+19+0i)", matcher.Description())

	floatExpected := float64(kExpected)
	castedInt := int64(floatExpected)

	cases := []equalsTestCase{
		// Equal values of numeric type.
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{castedInt, false, false, ""},
		equalsTestCase{int64(0), false, false, ""},
		equalsTestCase{int64(math.MinInt64), false, false, ""},
		equalsTestCase{int64(math.MaxInt64), false, false, ""},
		equalsTestCase{float32(kExpected / 2), false, false, ""},
		equalsTestCase{float64(kExpected / 2), false, false, ""},
		equalsTestCase{complex64(kExpected + 2i), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) ZeroComplex128() {
	matcher := Equals(complex128(0))
	ExpectEq("(0+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of zero.
		equalsTestCase{0.0, true, false, ""},
		equalsTestCase{0 + 0i, true, false, ""},
		equalsTestCase{int(0), true, false, ""},
		equalsTestCase{int8(0), true, false, ""},
		equalsTestCase{int16(0), true, false, ""},
		equalsTestCase{int32(0), true, false, ""},
		equalsTestCase{int64(0), true, false, ""},
		equalsTestCase{uint(0), true, false, ""},
		equalsTestCase{uint8(0), true, false, ""},
		equalsTestCase{uint16(0), true, false, ""},
		equalsTestCase{uint32(0), true, false, ""},
		equalsTestCase{uint64(0), true, false, ""},
		equalsTestCase{float32(0), true, false, ""},
		equalsTestCase{float64(0), true, false, ""},
		equalsTestCase{complex64(0), true, false, ""},
		equalsTestCase{complex128(0), true, false, ""},
		equalsTestCase{interface{}(float32(0)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(1), false, false, ""},
		equalsTestCase{int64(-1), false, false, ""},
		equalsTestCase{float32(1), false, false, ""},
		equalsTestCase{float32(-1), false, false, ""},
		equalsTestCase{float64(1), false, false, ""},
		equalsTestCase{float64(-1), false, false, ""},
		equalsTestCase{complex64(0 + 2i), false, false, ""},
		equalsTestCase{complex128(0 + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveIntegralComplex128() {
	const kExpected = 1 << 20
	matcher := Equals(complex128(kExpected))
	ExpectEq("(1.048576e+06+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of 32769.
		equalsTestCase{1048576.0, true, false, ""},
		equalsTestCase{1048576.0 + 0i, true, false, ""},
		equalsTestCase{int(kExpected), true, false, ""},
		equalsTestCase{int32(kExpected), true, false, ""},
		equalsTestCase{int64(kExpected), true, false, ""},
		equalsTestCase{uint(kExpected), true, false, ""},
		equalsTestCase{uint32(kExpected), true, false, ""},
		equalsTestCase{uint64(kExpected), true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},
		equalsTestCase{interface{}(float64(kExpected)), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(kExpected + 1), false, false, ""},
		equalsTestCase{int32(kExpected + 1), false, false, ""},
		equalsTestCase{int64(kExpected + 1), false, false, ""},
		equalsTestCase{uint(kExpected + 1), false, false, ""},
		equalsTestCase{uint32(kExpected + 1), false, false, ""},
		equalsTestCase{uint64(kExpected + 1), false, false, ""},
		equalsTestCase{float32(kExpected - (1 << 30)), false, false, ""},
		equalsTestCase{float32(kExpected + (1 << 30)), false, false, ""},
		equalsTestCase{float64(kExpected - 0.5), false, false, ""},
		equalsTestCase{float64(kExpected + 0.5), false, false, ""},
		equalsTestCase{complex128(kExpected - 1), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},

		// Non-numeric types.
		equalsTestCase{uintptr(0), false, true, "which is not numeric"},
		equalsTestCase{true, false, true, "which is not numeric"},
		equalsTestCase{[...]int{}, false, true, "which is not numeric"},
		equalsTestCase{make(chan int), false, true, "which is not numeric"},
		equalsTestCase{func() {}, false, true, "which is not numeric"},
		equalsTestCase{map[int]int{}, false, true, "which is not numeric"},
		equalsTestCase{&someInt, false, true, "which is not numeric"},
		equalsTestCase{[]int{}, false, true, "which is not numeric"},
		equalsTestCase{"taco", false, true, "which is not numeric"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not numeric"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) PositiveNonIntegralComplex128() {
	const kTwoTo20 = 1 << 20
	const kExpected = kTwoTo20 + 0.25
	matcher := Equals(complex128(kExpected))
	ExpectEq("(1.04857625e+06+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{kExpected, true, false, ""},
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int64(kTwoTo20), false, false, ""},
		equalsTestCase{int64(kTwoTo20 - 1), false, false, ""},
		equalsTestCase{uint64(kTwoTo20), false, false, ""},
		equalsTestCase{uint64(kTwoTo20 - 1), false, false, ""},
		equalsTestCase{float32(kExpected - 1), false, false, ""},
		equalsTestCase{float32(kExpected + 1), false, false, ""},
		equalsTestCase{float64(kExpected - 0.25), false, false, ""},
		equalsTestCase{float64(kExpected + 0.25), false, false, ""},
		equalsTestCase{complex64(kExpected - 1), false, false, ""},
		equalsTestCase{complex64(kExpected - 1i), false, false, ""},
		equalsTestCase{complex128(kExpected - 1), false, false, ""},
		equalsTestCase{complex128(kExpected - 1i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) LargePositiveComplex128() {
	const kExpected = 1 << 65
	matcher := Equals(complex128(kExpected))
	ExpectEq("(3.6893488147419103e+19+0i)", matcher.Description())

	floatExpected := float64(kExpected)
	castedInt := uint64(floatExpected)

	cases := []equalsTestCase{
		// Equal values of numeric type.
		equalsTestCase{kExpected + 0i, true, false, ""},
		equalsTestCase{float32(kExpected), true, false, ""},
		equalsTestCase{float64(kExpected), true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{castedInt, false, false, ""},
		equalsTestCase{int64(0), false, false, ""},
		equalsTestCase{int64(math.MinInt64), false, false, ""},
		equalsTestCase{int64(math.MaxInt64), false, false, ""},
		equalsTestCase{uint64(0), false, false, ""},
		equalsTestCase{uint64(math.MaxUint64), false, false, ""},
		equalsTestCase{float32(kExpected / 2), false, false, ""},
		equalsTestCase{float64(kExpected / 2), false, false, ""},
		equalsTestCase{complex128(kExpected + 2i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) Complex128AboveExactIntegerRange() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := Equals(complex128(kTwoTo54 + 1))
	ExpectEq("(1.8014398509481984e+16+0i)", matcher.Description())

	cases := []equalsTestCase{
		// Integers.
		equalsTestCase{int64(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{int64(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{int64(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{int64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{int64(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{int64(kTwoTo54 + 3), false, false, ""},

		equalsTestCase{uint64(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{uint64(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{uint64(kTwoTo54 + 3), false, false, ""},

		// Double-precision floating point.
		equalsTestCase{float64(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{float64(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{float64(kTwoTo54 + 3), false, false, ""},

		equalsTestCase{complex128(kTwoTo54 - 2), false, false, ""},
		equalsTestCase{complex128(kTwoTo54 - 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 0), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 1), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 2), true, false, ""},
		equalsTestCase{complex128(kTwoTo54 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) Complex128WithNonZeroImaginaryPart() {
	const kRealPart = 17
	const kImagPart = 0.25i
	const kExpected = kRealPart + kImagPart
	matcher := Equals(complex128(kExpected))
	ExpectEq("(17+0.25i)", matcher.Description())

	cases := []equalsTestCase{
		// Various types of the expected value.
		equalsTestCase{kExpected, true, false, ""},
		equalsTestCase{kRealPart + kImagPart, true, false, ""},
		equalsTestCase{complex64(kExpected), true, false, ""},
		equalsTestCase{complex128(kExpected), true, false, ""},

		// Non-equal values of numeric type.
		equalsTestCase{int(kRealPart), false, false, ""},
		equalsTestCase{int8(kRealPart), false, false, ""},
		equalsTestCase{int16(kRealPart), false, false, ""},
		equalsTestCase{int32(kRealPart), false, false, ""},
		equalsTestCase{int64(kRealPart), false, false, ""},
		equalsTestCase{uint(kRealPart), false, false, ""},
		equalsTestCase{uint8(kRealPart), false, false, ""},
		equalsTestCase{uint16(kRealPart), false, false, ""},
		equalsTestCase{uint32(kRealPart), false, false, ""},
		equalsTestCase{uint64(kRealPart), false, false, ""},
		equalsTestCase{float32(kRealPart), false, false, ""},
		equalsTestCase{float64(kRealPart), false, false, ""},
		equalsTestCase{complex64(kRealPart), false, false, ""},
		equalsTestCase{complex64(kRealPart + kImagPart + 0.5), false, false, ""},
		equalsTestCase{complex64(kRealPart + kImagPart + 0.5i), false, false, ""},
		equalsTestCase{complex128(kRealPart), false, false, ""},
		equalsTestCase{complex128(kRealPart + kImagPart + 0.5), false, false, ""},
		equalsTestCase{complex128(kRealPart + kImagPart + 0.5i), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// Arrays
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) ArrayOfComparableType() {
	expected := [3]uint{17, 19, 23}

	matcher := Equals(expected)
	ExpectEq("[17 19 23]", matcher.Description())

	// To defeat constant de-duping by the compiler.
	makeArray := func(i, j, k uint) [3]uint { return [3]uint{ i, j, k} }

	type arrayAlias [3]uint
	type uintAlias uint

	cases := []equalsTestCase{
		// Correct types, equal.
		equalsTestCase{expected, true, false, ""},
		equalsTestCase{[3]uint{17, 19, 23}, true, false, ""},
		equalsTestCase{makeArray(17, 19, 23), true, false, ""},

		// Correct types, not equal.
		equalsTestCase{[3]uint{0, 0, 0}, false, false, ""},
		equalsTestCase{[3]uint{18, 19, 23}, false, false, ""},
		equalsTestCase{[3]uint{17, 20, 23}, false, false, ""},
		equalsTestCase{[3]uint{17, 19, 22}, false, false, ""},

		// Other types.
		equalsTestCase{0, false, true, "which is not [3]uint"},
		equalsTestCase{bool(false), false, true, "which is not [3]uint"},
		equalsTestCase{int(0), false, true, "which is not [3]uint"},
		equalsTestCase{int8(0), false, true, "which is not [3]uint"},
		equalsTestCase{int16(0), false, true, "which is not [3]uint"},
		equalsTestCase{int32(0), false, true, "which is not [3]uint"},
		equalsTestCase{int64(0), false, true, "which is not [3]uint"},
		equalsTestCase{uint(0), false, true, "which is not [3]uint"},
		equalsTestCase{uint8(0), false, true, "which is not [3]uint"},
		equalsTestCase{uint16(0), false, true, "which is not [3]uint"},
		equalsTestCase{uint32(0), false, true, "which is not [3]uint"},
		equalsTestCase{uint64(0), false, true, "which is not [3]uint"},
		equalsTestCase{true, false, true, "which is not [3]uint"},
		equalsTestCase{[...]int{}, false, true, "which is not [3]uint"},
		equalsTestCase{func() {}, false, true, "which is not [3]uint"},
		equalsTestCase{map[int]int{}, false, true, "which is not [3]uint"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not [3]uint"},
		equalsTestCase{[2]uint{17, 19}, false, true, "which is not [3]uint"},
		equalsTestCase{[4]uint{17, 19, 23, 0}, false, true, "which is not [3]uint"},
		equalsTestCase{arrayAlias{17, 19, 23}, false, true, "which is not [3]uint"},
		equalsTestCase{[3]uintAlias{17, 19, 23}, false, true, "which is not [3]uint"},
		equalsTestCase{[3]int32{17, 19, 23}, false, true, "which is not [3]uint"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) ArrayOfNonComparableType() {
	type nonComparableArray [2]map[string]string
	f := func() {
		ExpectEq(nonComparableArray{}, nonComparableArray{})
	}

	ExpectThat(f, Panics(MatchesRegexp("uncomparable.*nonComparableArray")))
}

////////////////////////////////////////////////////////////////////////
// chan
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NilChan() {
	var nilChan1 chan int
	var nilChan2 chan int
	var nilChan3 chan uint
	var nonNilChan1 chan int = make(chan int)
	var nonNilChan2 chan uint = make(chan uint)

	matcher := Equals(nilChan1)
	ExpectEq("<nil>", matcher.Description())

	cases := []equalsTestCase{
		// int channels
		equalsTestCase{nilChan1, true, false, ""},
		equalsTestCase{nilChan2, true, false, ""},
		equalsTestCase{nonNilChan1, false, false, ""},

		// uint channels
		equalsTestCase{nilChan3, false, true, "which is not a chan int"},
		equalsTestCase{nonNilChan2, false, true, "which is not a chan int"},

		// Other types.
		equalsTestCase{0, false, true, "which is not a chan int"},
		equalsTestCase{bool(false), false, true, "which is not a chan int"},
		equalsTestCase{int(0), false, true, "which is not a chan int"},
		equalsTestCase{int8(0), false, true, "which is not a chan int"},
		equalsTestCase{int16(0), false, true, "which is not a chan int"},
		equalsTestCase{int32(0), false, true, "which is not a chan int"},
		equalsTestCase{int64(0), false, true, "which is not a chan int"},
		equalsTestCase{uint(0), false, true, "which is not a chan int"},
		equalsTestCase{uint8(0), false, true, "which is not a chan int"},
		equalsTestCase{uint16(0), false, true, "which is not a chan int"},
		equalsTestCase{uint32(0), false, true, "which is not a chan int"},
		equalsTestCase{uint64(0), false, true, "which is not a chan int"},
		equalsTestCase{true, false, true, "which is not a chan int"},
		equalsTestCase{[...]int{}, false, true, "which is not a chan int"},
		equalsTestCase{func() {}, false, true, "which is not a chan int"},
		equalsTestCase{map[int]int{}, false, true, "which is not a chan int"},
		equalsTestCase{&someInt, false, true, "which is not a chan int"},
		equalsTestCase{[]int{}, false, true, "which is not a chan int"},
		equalsTestCase{"taco", false, true, "which is not a chan int"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a chan int"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) NonNilChan() {
	var nilChan1 chan int
	var nilChan2 chan uint
	var nonNilChan1 chan int = make(chan int)
	var nonNilChan2 chan int = make(chan int)
	var nonNilChan3 chan uint = make(chan uint)

	matcher := Equals(nonNilChan1)
	ExpectEq(fmt.Sprintf("%v", nonNilChan1), matcher.Description())

	cases := []equalsTestCase{
		// int channels
		equalsTestCase{nonNilChan1, true, false, ""},
		equalsTestCase{nonNilChan2, false, false, ""},
		equalsTestCase{nilChan1, false, false, ""},

		// uint channels
		equalsTestCase{nilChan2, false, true, "which is not a chan int"},
		equalsTestCase{nonNilChan3, false, true, "which is not a chan int"},

		// Other types.
		equalsTestCase{0, false, true, "which is not a chan int"},
		equalsTestCase{bool(false), false, true, "which is not a chan int"},
		equalsTestCase{int(0), false, true, "which is not a chan int"},
		equalsTestCase{int8(0), false, true, "which is not a chan int"},
		equalsTestCase{int16(0), false, true, "which is not a chan int"},
		equalsTestCase{int32(0), false, true, "which is not a chan int"},
		equalsTestCase{int64(0), false, true, "which is not a chan int"},
		equalsTestCase{uint(0), false, true, "which is not a chan int"},
		equalsTestCase{uint8(0), false, true, "which is not a chan int"},
		equalsTestCase{uint16(0), false, true, "which is not a chan int"},
		equalsTestCase{uint32(0), false, true, "which is not a chan int"},
		equalsTestCase{uint64(0), false, true, "which is not a chan int"},
		equalsTestCase{true, false, true, "which is not a chan int"},
		equalsTestCase{[...]int{}, false, true, "which is not a chan int"},
		equalsTestCase{func() {}, false, true, "which is not a chan int"},
		equalsTestCase{map[int]int{}, false, true, "which is not a chan int"},
		equalsTestCase{&someInt, false, true, "which is not a chan int"},
		equalsTestCase{[]int{}, false, true, "which is not a chan int"},
		equalsTestCase{"taco", false, true, "which is not a chan int"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a chan int"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) ChanDirection() {
	var chan1 chan<- int
	var chan2 <-chan int
	var chan3 chan int

	matcher := Equals(chan1)
	ExpectEq(fmt.Sprintf("%v", chan1), matcher.Description())

	cases := []equalsTestCase{
		equalsTestCase{chan1, true, false, ""},
		equalsTestCase{chan2, false, true, "which is not a chan<- int"},
		equalsTestCase{chan3, false, true, "which is not a chan<- int"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// func
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) Functions() {
	func1 := func() {}
	func2 := func() {}
	func3 := func(x int) {}

	matcher := Equals(func1)
	ExpectEq(fmt.Sprintf("%v", func1), matcher.Description())

	cases := []equalsTestCase{
		// Functions.
		equalsTestCase{func1, true, false, ""},
		equalsTestCase{func2, false, false, ""},
		equalsTestCase{func3, false, false, ""},

		// Other types.
		equalsTestCase{0, false, true, "which is not a function"},
		equalsTestCase{bool(false), false, true, "which is not a function"},
		equalsTestCase{int(0), false, true, "which is not a function"},
		equalsTestCase{int8(0), false, true, "which is not a function"},
		equalsTestCase{int16(0), false, true, "which is not a function"},
		equalsTestCase{int32(0), false, true, "which is not a function"},
		equalsTestCase{int64(0), false, true, "which is not a function"},
		equalsTestCase{uint(0), false, true, "which is not a function"},
		equalsTestCase{uint8(0), false, true, "which is not a function"},
		equalsTestCase{uint16(0), false, true, "which is not a function"},
		equalsTestCase{uint32(0), false, true, "which is not a function"},
		equalsTestCase{uint64(0), false, true, "which is not a function"},
		equalsTestCase{true, false, true, "which is not a function"},
		equalsTestCase{[...]int{}, false, true, "which is not a function"},
		equalsTestCase{map[int]int{}, false, true, "which is not a function"},
		equalsTestCase{&someInt, false, true, "which is not a function"},
		equalsTestCase{[]int{}, false, true, "which is not a function"},
		equalsTestCase{"taco", false, true, "which is not a function"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a function"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// map
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NilMap() {
	var nilMap1 map[int]int
	var nilMap2 map[int]int
	var nilMap3 map[int]uint
	var nonNilMap1 map[int]int = make(map[int]int)
	var nonNilMap2 map[int]uint = make(map[int]uint)

	matcher := Equals(nilMap1)
	ExpectEq("map[]", matcher.Description())

	cases := []equalsTestCase{
		// Correct type.
		equalsTestCase{nilMap1, true, false, ""},
		equalsTestCase{nilMap2, true, false, ""},
		equalsTestCase{nilMap3, true, false, ""},
		equalsTestCase{nonNilMap1, false, false, ""},
		equalsTestCase{nonNilMap2, false, false, ""},

		// Other types.
		equalsTestCase{0, false, true, "which is not a map"},
		equalsTestCase{bool(false), false, true, "which is not a map"},
		equalsTestCase{int(0), false, true, "which is not a map"},
		equalsTestCase{int8(0), false, true, "which is not a map"},
		equalsTestCase{int16(0), false, true, "which is not a map"},
		equalsTestCase{int32(0), false, true, "which is not a map"},
		equalsTestCase{int64(0), false, true, "which is not a map"},
		equalsTestCase{uint(0), false, true, "which is not a map"},
		equalsTestCase{uint8(0), false, true, "which is not a map"},
		equalsTestCase{uint16(0), false, true, "which is not a map"},
		equalsTestCase{uint32(0), false, true, "which is not a map"},
		equalsTestCase{uint64(0), false, true, "which is not a map"},
		equalsTestCase{true, false, true, "which is not a map"},
		equalsTestCase{[...]int{}, false, true, "which is not a map"},
		equalsTestCase{func() {}, false, true, "which is not a map"},
		equalsTestCase{&someInt, false, true, "which is not a map"},
		equalsTestCase{[]int{}, false, true, "which is not a map"},
		equalsTestCase{"taco", false, true, "which is not a map"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a map"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) NonNilMap() {
	var nilMap1 map[int]int
	var nilMap2 map[int]uint
	var nonNilMap1 map[int]int = make(map[int]int)
	var nonNilMap2 map[int]int = make(map[int]int)
	var nonNilMap3 map[int]uint = make(map[int]uint)

	matcher := Equals(nonNilMap1)
	ExpectEq("map[]", matcher.Description())

	cases := []equalsTestCase{
		// Correct type.
		equalsTestCase{nonNilMap1, true, false, ""},
		equalsTestCase{nonNilMap2, false, false, ""},
		equalsTestCase{nonNilMap3, false, false, ""},
		equalsTestCase{nilMap1, false, false, ""},
		equalsTestCase{nilMap2, false, false, ""},

		// Other types.
		equalsTestCase{0, false, true, "which is not a map"},
		equalsTestCase{bool(false), false, true, "which is not a map"},
		equalsTestCase{int(0), false, true, "which is not a map"},
		equalsTestCase{int8(0), false, true, "which is not a map"},
		equalsTestCase{int16(0), false, true, "which is not a map"},
		equalsTestCase{int32(0), false, true, "which is not a map"},
		equalsTestCase{int64(0), false, true, "which is not a map"},
		equalsTestCase{uint(0), false, true, "which is not a map"},
		equalsTestCase{uint8(0), false, true, "which is not a map"},
		equalsTestCase{uint16(0), false, true, "which is not a map"},
		equalsTestCase{uint32(0), false, true, "which is not a map"},
		equalsTestCase{uint64(0), false, true, "which is not a map"},
		equalsTestCase{true, false, true, "which is not a map"},
		equalsTestCase{[...]int{}, false, true, "which is not a map"},
		equalsTestCase{func() {}, false, true, "which is not a map"},
		equalsTestCase{&someInt, false, true, "which is not a map"},
		equalsTestCase{[]int{}, false, true, "which is not a map"},
		equalsTestCase{"taco", false, true, "which is not a map"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a map"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// Pointers
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NilPointer() {
	var someInt int = 17
	var someUint uint = 17

	var nilInt1 *int
	var nilInt2 *int
	var nilUint *uint
	var nonNilInt *int = &someInt
	var nonNilUint *uint = &someUint

	matcher := Equals(nilInt1)
	ExpectEq("<nil>", matcher.Description())

	cases := []equalsTestCase{
		// Correct type.
		equalsTestCase{nilInt1, true, false, ""},
		equalsTestCase{nilInt2, true, false, ""},
		equalsTestCase{nonNilInt, false, false, ""},

		// Incorrect type.
		equalsTestCase{nilUint, false, true, "which is not a *int"},
		equalsTestCase{nonNilUint, false, true, "which is not a *int"},

		// Other types.
		equalsTestCase{0, false, true, "which is not a *int"},
		equalsTestCase{bool(false), false, true, "which is not a *int"},
		equalsTestCase{int(0), false, true, "which is not a *int"},
		equalsTestCase{int8(0), false, true, "which is not a *int"},
		equalsTestCase{int16(0), false, true, "which is not a *int"},
		equalsTestCase{int32(0), false, true, "which is not a *int"},
		equalsTestCase{int64(0), false, true, "which is not a *int"},
		equalsTestCase{uint(0), false, true, "which is not a *int"},
		equalsTestCase{uint8(0), false, true, "which is not a *int"},
		equalsTestCase{uint16(0), false, true, "which is not a *int"},
		equalsTestCase{uint32(0), false, true, "which is not a *int"},
		equalsTestCase{uint64(0), false, true, "which is not a *int"},
		equalsTestCase{true, false, true, "which is not a *int"},
		equalsTestCase{[...]int{}, false, true, "which is not a *int"},
		equalsTestCase{func() {}, false, true, "which is not a *int"},
		equalsTestCase{map[int]int{}, false, true, "which is not a *int"},
		equalsTestCase{[]int{}, false, true, "which is not a *int"},
		equalsTestCase{"taco", false, true, "which is not a *int"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a *int"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) NonNilPointer() {
	var someInt int = 17
	var someOtherInt int = 17
	var someUint uint = 17

	var nilInt *int
	var nilUint *uint
	var nonNilInt1 *int = &someInt
	var nonNilInt2 *int = &someOtherInt
	var nonNilUint *uint = &someUint

	matcher := Equals(nonNilInt1)
	ExpectEq(fmt.Sprintf("%v", nonNilInt1), matcher.Description())

	cases := []equalsTestCase{
		// Correct type.
		equalsTestCase{nonNilInt1, true, false, ""},
		equalsTestCase{nonNilInt2, false, false, ""},
		equalsTestCase{nilInt, false, false, ""},

		// Incorrect type.
		equalsTestCase{nilUint, false, true, "which is not a *int"},
		equalsTestCase{nonNilUint, false, true, "which is not a *int"},

		// Other types.
		equalsTestCase{0, false, true, "which is not a *int"},
		equalsTestCase{bool(false), false, true, "which is not a *int"},
		equalsTestCase{int(0), false, true, "which is not a *int"},
		equalsTestCase{int8(0), false, true, "which is not a *int"},
		equalsTestCase{int16(0), false, true, "which is not a *int"},
		equalsTestCase{int32(0), false, true, "which is not a *int"},
		equalsTestCase{int64(0), false, true, "which is not a *int"},
		equalsTestCase{uint(0), false, true, "which is not a *int"},
		equalsTestCase{uint8(0), false, true, "which is not a *int"},
		equalsTestCase{uint16(0), false, true, "which is not a *int"},
		equalsTestCase{uint32(0), false, true, "which is not a *int"},
		equalsTestCase{uint64(0), false, true, "which is not a *int"},
		equalsTestCase{true, false, true, "which is not a *int"},
		equalsTestCase{[...]int{}, false, true, "which is not a *int"},
		equalsTestCase{func() {}, false, true, "which is not a *int"},
		equalsTestCase{map[int]int{}, false, true, "which is not a *int"},
		equalsTestCase{[]int{}, false, true, "which is not a *int"},
		equalsTestCase{"taco", false, true, "which is not a *int"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a *int"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// Slices
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NilSlice() {
	var nilInt1 []int
	var nilInt2 []int
	var nilUint []uint

	var nonNilInt []int = make([]int, 0)
	var nonNilUint []uint = make([]uint, 0)

	matcher := Equals(nilInt1)
	ExpectEq("[]", matcher.Description())

	cases := []equalsTestCase{
		// Correct type.
		equalsTestCase{nilInt1, true, false, ""},
		equalsTestCase{nilInt2, true, false, ""},
		equalsTestCase{nonNilInt, false, false, ""},

		// Incorrect type.
		equalsTestCase{nilUint, false, true, "which is not a []int"},
		equalsTestCase{nonNilUint, false, true, "which is not a []int"},

		// Other types.
		equalsTestCase{0, false, true, "which is not a []int"},
		equalsTestCase{bool(false), false, true, "which is not a []int"},
		equalsTestCase{int(0), false, true, "which is not a []int"},
		equalsTestCase{int8(0), false, true, "which is not a []int"},
		equalsTestCase{int16(0), false, true, "which is not a []int"},
		equalsTestCase{int32(0), false, true, "which is not a []int"},
		equalsTestCase{int64(0), false, true, "which is not a []int"},
		equalsTestCase{uint(0), false, true, "which is not a []int"},
		equalsTestCase{uint8(0), false, true, "which is not a []int"},
		equalsTestCase{uint16(0), false, true, "which is not a []int"},
		equalsTestCase{uint32(0), false, true, "which is not a []int"},
		equalsTestCase{uint64(0), false, true, "which is not a []int"},
		equalsTestCase{true, false, true, "which is not a []int"},
		equalsTestCase{[...]int{}, false, true, "which is not a []int"},
		equalsTestCase{func() {}, false, true, "which is not a []int"},
		equalsTestCase{map[int]int{}, false, true, "which is not a []int"},
		equalsTestCase{"taco", false, true, "which is not a []int"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a []int"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) NonNilSlice() {
	nonNil := make([]int, 0)
	f := func() { Equals(nonNil) }
	ExpectThat(f, Panics(HasSubstr("non-nil slice")))
}

////////////////////////////////////////////////////////////////////////
// string
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) String() {
	partial := "taco"
	expected := fmt.Sprintf("%s%d", partial, 1)

	matcher := Equals(expected)
	ExpectEq("taco1", matcher.Description())

	type stringAlias string

	cases := []equalsTestCase{
		// Correct types.
		equalsTestCase{"taco1", true, false, ""},
		equalsTestCase{"taco" + "1", true, false, ""},
		equalsTestCase{expected, true, false, ""},
		equalsTestCase{stringAlias("taco1"), true, false, ""},

		equalsTestCase{"", false, false, ""},
		equalsTestCase{"taco", false, false, ""},
		equalsTestCase{"taco1\x00", false, false, ""},
		equalsTestCase{"taco2", false, false, ""},
		equalsTestCase{stringAlias("taco2"), false, false, ""},

		// Other types.
		equalsTestCase{0, false, true, "which is not a string"},
		equalsTestCase{bool(false), false, true, "which is not a string"},
		equalsTestCase{int(0), false, true, "which is not a string"},
		equalsTestCase{int8(0), false, true, "which is not a string"},
		equalsTestCase{int16(0), false, true, "which is not a string"},
		equalsTestCase{int32(0), false, true, "which is not a string"},
		equalsTestCase{int64(0), false, true, "which is not a string"},
		equalsTestCase{uint(0), false, true, "which is not a string"},
		equalsTestCase{uint8(0), false, true, "which is not a string"},
		equalsTestCase{uint16(0), false, true, "which is not a string"},
		equalsTestCase{uint32(0), false, true, "which is not a string"},
		equalsTestCase{uint64(0), false, true, "which is not a string"},
		equalsTestCase{true, false, true, "which is not a string"},
		equalsTestCase{[...]int{}, false, true, "which is not a string"},
		equalsTestCase{func() {}, false, true, "which is not a string"},
		equalsTestCase{map[int]int{}, false, true, "which is not a string"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a string"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) StringAlias() {
	type stringAlias string

	matcher := Equals(stringAlias("taco"))
	ExpectEq("taco", matcher.Description())

	cases := []equalsTestCase{
		// Correct types.
		equalsTestCase{stringAlias("taco"), true, false, ""},
		equalsTestCase{"taco", true, false, ""},

		equalsTestCase{"burrito", false, false, ""},
		equalsTestCase{stringAlias("burrito"), false, false, ""},

		// Other types.
		equalsTestCase{0, false, true, "which is not a string"},
		equalsTestCase{bool(false), false, true, "which is not a string"},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// struct
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) Struct() {
	type someStruct struct{ foo uint }
	f := func() { Equals(someStruct{17}) }
	ExpectThat(f, Panics(HasSubstr("unsupported kind struct")))
}

////////////////////////////////////////////////////////////////////////
// unsafe.Pointer
////////////////////////////////////////////////////////////////////////

func (t *EqualsTest) NilUnsafePointer() {
	someInt := int(17)

	var nilPtr1 unsafe.Pointer
	var nilPtr2 unsafe.Pointer
	var nonNilPtr unsafe.Pointer = unsafe.Pointer(&someInt)

	matcher := Equals(nilPtr1)
	ExpectEq("<nil>", matcher.Description())

	cases := []equalsTestCase{
		// Correct type.
		equalsTestCase{nilPtr1, true, false, ""},
		equalsTestCase{nilPtr2, true, false, ""},
		equalsTestCase{nonNilPtr, false, false, ""},

		// Other types.
		equalsTestCase{0, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{bool(false), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{int(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{int8(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{int16(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{int32(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{int64(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uint(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uint8(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uint16(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uint32(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uint64(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uintptr(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{true, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{[...]int{}, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{make(chan int), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{func() {}, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{map[int]int{}, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{&someInt, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{[]int{}, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{"taco", false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a unsafe.Pointer"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *EqualsTest) NonNilUnsafePointer() {
	someInt := int(17)
	someOtherInt := int(17)

	var nilPtr unsafe.Pointer
	var nonNilPtr1 unsafe.Pointer = unsafe.Pointer(&someInt)
	var nonNilPtr2 unsafe.Pointer = unsafe.Pointer(&someOtherInt)

	matcher := Equals(nonNilPtr1)
	ExpectEq(fmt.Sprintf("%v", nonNilPtr1), matcher.Description())

	cases := []equalsTestCase{
		// Correct type.
		equalsTestCase{nonNilPtr1, true, false, ""},
		equalsTestCase{nonNilPtr2, false, false, ""},
		equalsTestCase{nilPtr, false, false, ""},

		// Other types.
		equalsTestCase{0, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{bool(false), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{int(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{int8(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{int16(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{int32(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{int64(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uint(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uint8(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uint16(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uint32(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uint64(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{uintptr(0), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{true, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{[...]int{}, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{make(chan int), false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{func() {}, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{map[int]int{}, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{&someInt, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{[]int{}, false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{"taco", false, true, "which is not a unsafe.Pointer"},
		equalsTestCase{equalsTestCase{}, false, true, "which is not a unsafe.Pointer"},
	}

	t.checkTestCases(matcher, cases)
}
