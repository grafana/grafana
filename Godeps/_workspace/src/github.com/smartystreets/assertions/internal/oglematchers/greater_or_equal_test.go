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
	"math"

	. "github.com/smartystreets/assertions/internal/oglematchers"
	. "github.com/smartystreets/assertions/internal/ogletest"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type GreaterOrEqualTest struct {
}

func init() { RegisterTestSuite(&GreaterOrEqualTest{}) }

type geTestCase struct {
	candidate      interface{}
	expectedResult bool
	shouldBeFatal  bool
	expectedError  string
}

func (t *GreaterOrEqualTest) checkTestCases(matcher Matcher, cases []geTestCase) {
	for i, c := range cases {
		err := matcher.Matches(c.candidate)

		ExpectThat(
			(err == nil),
			Equals(c.expectedResult),
			"Case %d (candidate %v)",
			i,
			c.candidate)

		if err == nil {
			continue
		}

		_, isFatal := err.(*FatalError)
		ExpectEq(
			c.shouldBeFatal,
			isFatal,
			"Case %d (candidate %v)",
			i,
			c.candidate)

		ExpectThat(
			err,
			Error(Equals(c.expectedError)),
			"Case %d (candidate %v)",
			i,
			c.candidate)
	}
}

////////////////////////////////////////////////////////////////////////
// Integer literals
////////////////////////////////////////////////////////////////////////

func (t *GreaterOrEqualTest) IntegerCandidateBadTypes() {
	matcher := GreaterOrEqual(int(-150))

	cases := []geTestCase{
		geTestCase{true, false, true, "which is not comparable"},
		geTestCase{uintptr(17), false, true, "which is not comparable"},
		geTestCase{complex64(-151), false, true, "which is not comparable"},
		geTestCase{complex128(-151), false, true, "which is not comparable"},
		geTestCase{[...]int{-151}, false, true, "which is not comparable"},
		geTestCase{make(chan int), false, true, "which is not comparable"},
		geTestCase{func() {}, false, true, "which is not comparable"},
		geTestCase{map[int]int{}, false, true, "which is not comparable"},
		geTestCase{&geTestCase{}, false, true, "which is not comparable"},
		geTestCase{make([]int, 0), false, true, "which is not comparable"},
		geTestCase{"-151", false, true, "which is not comparable"},
		geTestCase{geTestCase{}, false, true, "which is not comparable"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) FloatCandidateBadTypes() {
	matcher := GreaterOrEqual(float32(-150))

	cases := []geTestCase{
		geTestCase{true, false, true, "which is not comparable"},
		geTestCase{uintptr(17), false, true, "which is not comparable"},
		geTestCase{complex64(-151), false, true, "which is not comparable"},
		geTestCase{complex128(-151), false, true, "which is not comparable"},
		geTestCase{[...]int{-151}, false, true, "which is not comparable"},
		geTestCase{make(chan int), false, true, "which is not comparable"},
		geTestCase{func() {}, false, true, "which is not comparable"},
		geTestCase{map[int]int{}, false, true, "which is not comparable"},
		geTestCase{&geTestCase{}, false, true, "which is not comparable"},
		geTestCase{make([]int, 0), false, true, "which is not comparable"},
		geTestCase{"-151", false, true, "which is not comparable"},
		geTestCase{geTestCase{}, false, true, "which is not comparable"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) StringCandidateBadTypes() {
	matcher := GreaterOrEqual("17")

	cases := []geTestCase{
		geTestCase{true, false, true, "which is not comparable"},
		geTestCase{int(0), false, true, "which is not comparable"},
		geTestCase{int8(0), false, true, "which is not comparable"},
		geTestCase{int16(0), false, true, "which is not comparable"},
		geTestCase{int32(0), false, true, "which is not comparable"},
		geTestCase{int64(0), false, true, "which is not comparable"},
		geTestCase{uint(0), false, true, "which is not comparable"},
		geTestCase{uint8(0), false, true, "which is not comparable"},
		geTestCase{uint16(0), false, true, "which is not comparable"},
		geTestCase{uint32(0), false, true, "which is not comparable"},
		geTestCase{uint64(0), false, true, "which is not comparable"},
		geTestCase{uintptr(17), false, true, "which is not comparable"},
		geTestCase{float32(0), false, true, "which is not comparable"},
		geTestCase{float64(0), false, true, "which is not comparable"},
		geTestCase{complex64(-151), false, true, "which is not comparable"},
		geTestCase{complex128(-151), false, true, "which is not comparable"},
		geTestCase{[...]int{-151}, false, true, "which is not comparable"},
		geTestCase{make(chan int), false, true, "which is not comparable"},
		geTestCase{func() {}, false, true, "which is not comparable"},
		geTestCase{map[int]int{}, false, true, "which is not comparable"},
		geTestCase{&geTestCase{}, false, true, "which is not comparable"},
		geTestCase{make([]int, 0), false, true, "which is not comparable"},
		geTestCase{geTestCase{}, false, true, "which is not comparable"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) BadArgument() {
	panicked := false

	defer func() {
		ExpectThat(panicked, Equals(true))
	}()

	defer func() {
		if r := recover(); r != nil {
			panicked = true
		}
	}()

	GreaterOrEqual(complex128(0))
}

////////////////////////////////////////////////////////////////////////
// Integer literals
////////////////////////////////////////////////////////////////////////

func (t *GreaterOrEqualTest) NegativeIntegerLiteral() {
	matcher := GreaterOrEqual(-150)
	desc := matcher.Description()
	expectedDesc := "greater than or equal to -150"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		// Signed integers.
		geTestCase{-(1 << 30), false, false, ""},
		geTestCase{-151, false, false, ""},
		geTestCase{-150, true, false, ""},
		geTestCase{0, true, false, ""},
		geTestCase{17, true, false, ""},

		geTestCase{int(-(1 << 30)), false, false, ""},
		geTestCase{int(-151), false, false, ""},
		geTestCase{int(-150), true, false, ""},
		geTestCase{int(0), true, false, ""},
		geTestCase{int(17), true, false, ""},

		geTestCase{int8(-127), true, false, ""},
		geTestCase{int8(0), true, false, ""},
		geTestCase{int8(17), true, false, ""},

		geTestCase{int16(-(1 << 14)), false, false, ""},
		geTestCase{int16(-151), false, false, ""},
		geTestCase{int16(-150), true, false, ""},
		geTestCase{int16(0), true, false, ""},
		geTestCase{int16(17), true, false, ""},

		geTestCase{int32(-(1 << 30)), false, false, ""},
		geTestCase{int32(-151), false, false, ""},
		geTestCase{int32(-150), true, false, ""},
		geTestCase{int32(0), true, false, ""},
		geTestCase{int32(17), true, false, ""},

		geTestCase{int64(-(1 << 30)), false, false, ""},
		geTestCase{int64(-151), false, false, ""},
		geTestCase{int64(-150), true, false, ""},
		geTestCase{int64(0), true, false, ""},
		geTestCase{int64(17), true, false, ""},

		// Unsigned integers.
		geTestCase{uint((1 << 32) - 151), true, false, ""},
		geTestCase{uint(0), true, false, ""},
		geTestCase{uint(17), true, false, ""},

		geTestCase{uint8(0), true, false, ""},
		geTestCase{uint8(17), true, false, ""},
		geTestCase{uint8(253), true, false, ""},

		geTestCase{uint16((1 << 16) - 151), true, false, ""},
		geTestCase{uint16(0), true, false, ""},
		geTestCase{uint16(17), true, false, ""},

		geTestCase{uint32((1 << 32) - 151), true, false, ""},
		geTestCase{uint32(0), true, false, ""},
		geTestCase{uint32(17), true, false, ""},

		geTestCase{uint64((1 << 64) - 151), true, false, ""},
		geTestCase{uint64(0), true, false, ""},
		geTestCase{uint64(17), true, false, ""},

		// Floating point.
		geTestCase{float32(-(1 << 30)), false, false, ""},
		geTestCase{float32(-151), false, false, ""},
		geTestCase{float32(-150.1), false, false, ""},
		geTestCase{float32(-150), true, false, ""},
		geTestCase{float32(-149.9), true, false, ""},
		geTestCase{float32(0), true, false, ""},
		geTestCase{float32(17), true, false, ""},
		geTestCase{float32(160), true, false, ""},

		geTestCase{float64(-(1 << 30)), false, false, ""},
		geTestCase{float64(-151), false, false, ""},
		geTestCase{float64(-150.1), false, false, ""},
		geTestCase{float64(-150), true, false, ""},
		geTestCase{float64(-149.9), true, false, ""},
		geTestCase{float64(0), true, false, ""},
		geTestCase{float64(17), true, false, ""},
		geTestCase{float64(160), true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) ZeroIntegerLiteral() {
	matcher := GreaterOrEqual(0)
	desc := matcher.Description()
	expectedDesc := "greater than or equal to 0"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		// Signed integers.
		geTestCase{-(1 << 30), false, false, ""},
		geTestCase{-1, false, false, ""},
		geTestCase{0, true, false, ""},
		geTestCase{1, true, false, ""},
		geTestCase{17, true, false, ""},
		geTestCase{(1 << 30), true, false, ""},

		geTestCase{int(-(1 << 30)), false, false, ""},
		geTestCase{int(-1), false, false, ""},
		geTestCase{int(0), true, false, ""},
		geTestCase{int(1), true, false, ""},
		geTestCase{int(17), true, false, ""},

		geTestCase{int8(-1), false, false, ""},
		geTestCase{int8(0), true, false, ""},
		geTestCase{int8(1), true, false, ""},

		geTestCase{int16(-(1 << 14)), false, false, ""},
		geTestCase{int16(-1), false, false, ""},
		geTestCase{int16(0), true, false, ""},
		geTestCase{int16(1), true, false, ""},
		geTestCase{int16(17), true, false, ""},

		geTestCase{int32(-(1 << 30)), false, false, ""},
		geTestCase{int32(-1), false, false, ""},
		geTestCase{int32(0), true, false, ""},
		geTestCase{int32(1), true, false, ""},
		geTestCase{int32(17), true, false, ""},

		geTestCase{int64(-(1 << 30)), false, false, ""},
		geTestCase{int64(-1), false, false, ""},
		geTestCase{int64(0), true, false, ""},
		geTestCase{int64(1), true, false, ""},
		geTestCase{int64(17), true, false, ""},

		// Unsigned integers.
		geTestCase{uint((1 << 32) - 1), true, false, ""},
		geTestCase{uint(0), true, false, ""},
		geTestCase{uint(17), true, false, ""},

		geTestCase{uint8(0), true, false, ""},
		geTestCase{uint8(17), true, false, ""},
		geTestCase{uint8(253), true, false, ""},

		geTestCase{uint16((1 << 16) - 1), true, false, ""},
		geTestCase{uint16(0), true, false, ""},
		geTestCase{uint16(17), true, false, ""},

		geTestCase{uint32((1 << 32) - 1), true, false, ""},
		geTestCase{uint32(0), true, false, ""},
		geTestCase{uint32(17), true, false, ""},

		geTestCase{uint64((1 << 64) - 1), true, false, ""},
		geTestCase{uint64(0), true, false, ""},
		geTestCase{uint64(17), true, false, ""},

		// Floating point.
		geTestCase{float32(-(1 << 30)), false, false, ""},
		geTestCase{float32(-1), false, false, ""},
		geTestCase{float32(-0.1), false, false, ""},
		geTestCase{float32(-0.0), true, false, ""},
		geTestCase{float32(0), true, false, ""},
		geTestCase{float32(0.1), true, false, ""},
		geTestCase{float32(17), true, false, ""},
		geTestCase{float32(160), true, false, ""},

		geTestCase{float64(-(1 << 30)), false, false, ""},
		geTestCase{float64(-1), false, false, ""},
		geTestCase{float64(-0.1), false, false, ""},
		geTestCase{float64(-0), true, false, ""},
		geTestCase{float64(0), true, false, ""},
		geTestCase{float64(17), true, false, ""},
		geTestCase{float64(160), true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) PositiveIntegerLiteral() {
	matcher := GreaterOrEqual(150)
	desc := matcher.Description()
	expectedDesc := "greater than or equal to 150"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		// Signed integers.
		geTestCase{-1, false, false, ""},
		geTestCase{149, false, false, ""},
		geTestCase{150, true, false, ""},
		geTestCase{151, true, false, ""},

		geTestCase{int(-1), false, false, ""},
		geTestCase{int(149), false, false, ""},
		geTestCase{int(150), true, false, ""},
		geTestCase{int(151), true, false, ""},

		geTestCase{int8(-1), false, false, ""},
		geTestCase{int8(0), false, false, ""},
		geTestCase{int8(17), false, false, ""},
		geTestCase{int8(127), false, false, ""},

		geTestCase{int16(-1), false, false, ""},
		geTestCase{int16(149), false, false, ""},
		geTestCase{int16(150), true, false, ""},
		geTestCase{int16(151), true, false, ""},

		geTestCase{int32(-1), false, false, ""},
		geTestCase{int32(149), false, false, ""},
		geTestCase{int32(150), true, false, ""},
		geTestCase{int32(151), true, false, ""},

		geTestCase{int64(-1), false, false, ""},
		geTestCase{int64(149), false, false, ""},
		geTestCase{int64(150), true, false, ""},
		geTestCase{int64(151), true, false, ""},

		// Unsigned integers.
		geTestCase{uint(0), false, false, ""},
		geTestCase{uint(149), false, false, ""},
		geTestCase{uint(150), true, false, ""},
		geTestCase{uint(151), true, false, ""},

		geTestCase{uint8(0), false, false, ""},
		geTestCase{uint8(127), false, false, ""},

		geTestCase{uint16(0), false, false, ""},
		geTestCase{uint16(149), false, false, ""},
		geTestCase{uint16(150), true, false, ""},
		geTestCase{uint16(151), true, false, ""},

		geTestCase{uint32(0), false, false, ""},
		geTestCase{uint32(149), false, false, ""},
		geTestCase{uint32(150), true, false, ""},
		geTestCase{uint32(151), true, false, ""},

		geTestCase{uint64(0), false, false, ""},
		geTestCase{uint64(149), false, false, ""},
		geTestCase{uint64(150), true, false, ""},
		geTestCase{uint64(151), true, false, ""},

		// Floating point.
		geTestCase{float32(-1), false, false, ""},
		geTestCase{float32(149), false, false, ""},
		geTestCase{float32(149.9), false, false, ""},
		geTestCase{float32(150), true, false, ""},
		geTestCase{float32(150.1), true, false, ""},
		geTestCase{float32(151), true, false, ""},

		geTestCase{float64(-1), false, false, ""},
		geTestCase{float64(149), false, false, ""},
		geTestCase{float64(149.9), false, false, ""},
		geTestCase{float64(150), true, false, ""},
		geTestCase{float64(150.1), true, false, ""},
		geTestCase{float64(151), true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// Float literals
////////////////////////////////////////////////////////////////////////

func (t *GreaterOrEqualTest) NegativeFloatLiteral() {
	matcher := GreaterOrEqual(-150.1)
	desc := matcher.Description()
	expectedDesc := "greater than or equal to -150.1"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		// Signed integers.
		geTestCase{-(1 << 30), false, false, ""},
		geTestCase{-151, false, false, ""},
		geTestCase{-150, true, false, ""},
		geTestCase{0, true, false, ""},
		geTestCase{17, true, false, ""},

		geTestCase{int(-(1 << 30)), false, false, ""},
		geTestCase{int(-151), false, false, ""},
		geTestCase{int(-150), true, false, ""},
		geTestCase{int(0), true, false, ""},
		geTestCase{int(17), true, false, ""},

		geTestCase{int8(-127), true, false, ""},
		geTestCase{int8(0), true, false, ""},
		geTestCase{int8(17), true, false, ""},

		geTestCase{int16(-(1 << 14)), false, false, ""},
		geTestCase{int16(-151), false, false, ""},
		geTestCase{int16(-150), true, false, ""},
		geTestCase{int16(0), true, false, ""},
		geTestCase{int16(17), true, false, ""},

		geTestCase{int32(-(1 << 30)), false, false, ""},
		geTestCase{int32(-151), false, false, ""},
		geTestCase{int32(-150), true, false, ""},
		geTestCase{int32(0), true, false, ""},
		geTestCase{int32(17), true, false, ""},

		geTestCase{int64(-(1 << 30)), false, false, ""},
		geTestCase{int64(-151), false, false, ""},
		geTestCase{int64(-150), true, false, ""},
		geTestCase{int64(0), true, false, ""},
		geTestCase{int64(17), true, false, ""},

		// Unsigned integers.
		geTestCase{uint((1 << 32) - 151), true, false, ""},
		geTestCase{uint(0), true, false, ""},
		geTestCase{uint(17), true, false, ""},

		geTestCase{uint8(0), true, false, ""},
		geTestCase{uint8(17), true, false, ""},
		geTestCase{uint8(253), true, false, ""},

		geTestCase{uint16((1 << 16) - 151), true, false, ""},
		geTestCase{uint16(0), true, false, ""},
		geTestCase{uint16(17), true, false, ""},

		geTestCase{uint32((1 << 32) - 151), true, false, ""},
		geTestCase{uint32(0), true, false, ""},
		geTestCase{uint32(17), true, false, ""},

		geTestCase{uint64((1 << 64) - 151), true, false, ""},
		geTestCase{uint64(0), true, false, ""},
		geTestCase{uint64(17), true, false, ""},

		// Floating point.
		geTestCase{float32(-(1 << 30)), false, false, ""},
		geTestCase{float32(-151), false, false, ""},
		geTestCase{float32(-150.2), false, false, ""},
		geTestCase{float32(-150.1), true, false, ""},
		geTestCase{float32(-150), true, false, ""},
		geTestCase{float32(0), true, false, ""},
		geTestCase{float32(17), true, false, ""},
		geTestCase{float32(160), true, false, ""},

		geTestCase{float64(-(1 << 30)), false, false, ""},
		geTestCase{float64(-151), false, false, ""},
		geTestCase{float64(-150.2), false, false, ""},
		geTestCase{float64(-150.1), true, false, ""},
		geTestCase{float64(-150), true, false, ""},
		geTestCase{float64(0), true, false, ""},
		geTestCase{float64(17), true, false, ""},
		geTestCase{float64(160), true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) PositiveFloatLiteral() {
	matcher := GreaterOrEqual(149.9)
	desc := matcher.Description()
	expectedDesc := "greater than or equal to 149.9"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		// Signed integers.
		geTestCase{-1, false, false, ""},
		geTestCase{149, false, false, ""},
		geTestCase{150, true, false, ""},
		geTestCase{151, true, false, ""},

		geTestCase{int(-1), false, false, ""},
		geTestCase{int(149), false, false, ""},
		geTestCase{int(150), true, false, ""},
		geTestCase{int(151), true, false, ""},

		geTestCase{int8(-1), false, false, ""},
		geTestCase{int8(0), false, false, ""},
		geTestCase{int8(17), false, false, ""},
		geTestCase{int8(127), false, false, ""},

		geTestCase{int16(-1), false, false, ""},
		geTestCase{int16(149), false, false, ""},
		geTestCase{int16(150), true, false, ""},
		geTestCase{int16(151), true, false, ""},

		geTestCase{int32(-1), false, false, ""},
		geTestCase{int32(149), false, false, ""},
		geTestCase{int32(150), true, false, ""},
		geTestCase{int32(151), true, false, ""},

		geTestCase{int64(-1), false, false, ""},
		geTestCase{int64(149), false, false, ""},
		geTestCase{int64(150), true, false, ""},
		geTestCase{int64(151), true, false, ""},

		// Unsigned integers.
		geTestCase{uint(0), false, false, ""},
		geTestCase{uint(149), false, false, ""},
		geTestCase{uint(150), true, false, ""},
		geTestCase{uint(151), true, false, ""},

		geTestCase{uint8(0), false, false, ""},
		geTestCase{uint8(127), false, false, ""},

		geTestCase{uint16(0), false, false, ""},
		geTestCase{uint16(149), false, false, ""},
		geTestCase{uint16(150), true, false, ""},
		geTestCase{uint16(151), true, false, ""},

		geTestCase{uint32(0), false, false, ""},
		geTestCase{uint32(149), false, false, ""},
		geTestCase{uint32(150), true, false, ""},
		geTestCase{uint32(151), true, false, ""},

		geTestCase{uint64(0), false, false, ""},
		geTestCase{uint64(149), false, false, ""},
		geTestCase{uint64(150), true, false, ""},
		geTestCase{uint64(151), true, false, ""},

		// Floating point.
		geTestCase{float32(-1), false, false, ""},
		geTestCase{float32(149), false, false, ""},
		geTestCase{float32(149.8), false, false, ""},
		geTestCase{float32(149.9), true, false, ""},
		geTestCase{float32(150), true, false, ""},
		geTestCase{float32(151), true, false, ""},

		geTestCase{float64(-1), false, false, ""},
		geTestCase{float64(149), false, false, ""},
		geTestCase{float64(149.8), false, false, ""},
		geTestCase{float64(149.9), true, false, ""},
		geTestCase{float64(150), true, false, ""},
		geTestCase{float64(151), true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// Subtle cases
////////////////////////////////////////////////////////////////////////

func (t *GreaterOrEqualTest) Int64NotExactlyRepresentableBySinglePrecision() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := GreaterOrEqual(int64(kTwoTo25 + 1))

	desc := matcher.Description()
	expectedDesc := "greater than or equal to 33554433"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		// Signed integers.
		geTestCase{-1, false, false, ""},
		geTestCase{kTwoTo25 + 0, false, false, ""},
		geTestCase{kTwoTo25 + 1, true, false, ""},
		geTestCase{kTwoTo25 + 2, true, false, ""},

		geTestCase{int(-1), false, false, ""},
		geTestCase{int(kTwoTo25 + 0), false, false, ""},
		geTestCase{int(kTwoTo25 + 1), true, false, ""},
		geTestCase{int(kTwoTo25 + 2), true, false, ""},

		geTestCase{int8(-1), false, false, ""},
		geTestCase{int8(127), false, false, ""},

		geTestCase{int16(-1), false, false, ""},
		geTestCase{int16(0), false, false, ""},
		geTestCase{int16(32767), false, false, ""},

		geTestCase{int32(-1), false, false, ""},
		geTestCase{int32(kTwoTo25 + 0), false, false, ""},
		geTestCase{int32(kTwoTo25 + 1), true, false, ""},
		geTestCase{int32(kTwoTo25 + 2), true, false, ""},

		geTestCase{int64(-1), false, false, ""},
		geTestCase{int64(kTwoTo25 + 0), false, false, ""},
		geTestCase{int64(kTwoTo25 + 1), true, false, ""},
		geTestCase{int64(kTwoTo25 + 2), true, false, ""},

		// Unsigned integers.
		geTestCase{uint(0), false, false, ""},
		geTestCase{uint(kTwoTo25 + 0), false, false, ""},
		geTestCase{uint(kTwoTo25 + 1), true, false, ""},
		geTestCase{uint(kTwoTo25 + 2), true, false, ""},

		geTestCase{uint8(0), false, false, ""},
		geTestCase{uint8(255), false, false, ""},

		geTestCase{uint16(0), false, false, ""},
		geTestCase{uint16(65535), false, false, ""},

		geTestCase{uint32(0), false, false, ""},
		geTestCase{uint32(kTwoTo25 + 0), false, false, ""},
		geTestCase{uint32(kTwoTo25 + 1), true, false, ""},
		geTestCase{uint32(kTwoTo25 + 2), true, false, ""},

		geTestCase{uint64(0), false, false, ""},
		geTestCase{uint64(kTwoTo25 + 0), false, false, ""},
		geTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		geTestCase{uint64(kTwoTo25 + 2), true, false, ""},

		// Floating point.
		geTestCase{float32(-1), false, false, ""},
		geTestCase{float32(kTwoTo25 - 2), false, false, ""},
		geTestCase{float32(kTwoTo25 - 1), true, false, ""},
		geTestCase{float32(kTwoTo25 + 0), true, false, ""},
		geTestCase{float32(kTwoTo25 + 1), true, false, ""},
		geTestCase{float32(kTwoTo25 + 2), true, false, ""},
		geTestCase{float32(kTwoTo25 + 3), true, false, ""},

		geTestCase{float64(-1), false, false, ""},
		geTestCase{float64(kTwoTo25 - 2), false, false, ""},
		geTestCase{float64(kTwoTo25 - 1), false, false, ""},
		geTestCase{float64(kTwoTo25 + 0), false, false, ""},
		geTestCase{float64(kTwoTo25 + 1), true, false, ""},
		geTestCase{float64(kTwoTo25 + 2), true, false, ""},
		geTestCase{float64(kTwoTo25 + 3), true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) Int64NotExactlyRepresentableByDoublePrecision() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := GreaterOrEqual(int64(kTwoTo54 + 1))

	desc := matcher.Description()
	expectedDesc := "greater than or equal to 18014398509481985"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		// Signed integers.
		geTestCase{-1, false, false, ""},
		geTestCase{1 << 30, false, false, ""},

		geTestCase{int(-1), false, false, ""},
		geTestCase{int(math.MaxInt32), false, false, ""},

		geTestCase{int8(-1), false, false, ""},
		geTestCase{int8(127), false, false, ""},

		geTestCase{int16(-1), false, false, ""},
		geTestCase{int16(0), false, false, ""},
		geTestCase{int16(32767), false, false, ""},

		geTestCase{int32(-1), false, false, ""},
		geTestCase{int32(math.MaxInt32), false, false, ""},

		geTestCase{int64(-1), false, false, ""},
		geTestCase{int64(kTwoTo54 - 1), false, false, ""},
		geTestCase{int64(kTwoTo54 + 0), false, false, ""},
		geTestCase{int64(kTwoTo54 + 1), true, false, ""},
		geTestCase{int64(kTwoTo54 + 2), true, false, ""},

		// Unsigned integers.
		geTestCase{uint(0), false, false, ""},
		geTestCase{uint(math.MaxUint32), false, false, ""},

		geTestCase{uint8(0), false, false, ""},
		geTestCase{uint8(255), false, false, ""},

		geTestCase{uint16(0), false, false, ""},
		geTestCase{uint16(65535), false, false, ""},

		geTestCase{uint32(0), false, false, ""},
		geTestCase{uint32(math.MaxUint32), false, false, ""},

		geTestCase{uint64(0), false, false, ""},
		geTestCase{uint64(kTwoTo54 - 1), false, false, ""},
		geTestCase{uint64(kTwoTo54 + 0), false, false, ""},
		geTestCase{uint64(kTwoTo54 + 1), true, false, ""},
		geTestCase{uint64(kTwoTo54 + 2), true, false, ""},

		// Floating point.
		geTestCase{float64(-1), false, false, ""},
		geTestCase{float64(kTwoTo54 - 2), false, false, ""},
		geTestCase{float64(kTwoTo54 - 1), true, false, ""},
		geTestCase{float64(kTwoTo54 + 0), true, false, ""},
		geTestCase{float64(kTwoTo54 + 1), true, false, ""},
		geTestCase{float64(kTwoTo54 + 2), true, false, ""},
		geTestCase{float64(kTwoTo54 + 3), true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) Uint64NotExactlyRepresentableBySinglePrecision() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := GreaterOrEqual(uint64(kTwoTo25 + 1))

	desc := matcher.Description()
	expectedDesc := "greater than or equal to 33554433"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		// Signed integers.
		geTestCase{-1, false, false, ""},
		geTestCase{kTwoTo25 + 0, false, false, ""},
		geTestCase{kTwoTo25 + 1, true, false, ""},
		geTestCase{kTwoTo25 + 2, true, false, ""},

		geTestCase{int(-1), false, false, ""},
		geTestCase{int(kTwoTo25 + 0), false, false, ""},
		geTestCase{int(kTwoTo25 + 1), true, false, ""},
		geTestCase{int(kTwoTo25 + 2), true, false, ""},

		geTestCase{int8(-1), false, false, ""},
		geTestCase{int8(127), false, false, ""},

		geTestCase{int16(-1), false, false, ""},
		geTestCase{int16(0), false, false, ""},
		geTestCase{int16(32767), false, false, ""},

		geTestCase{int32(-1), false, false, ""},
		geTestCase{int32(kTwoTo25 + 0), false, false, ""},
		geTestCase{int32(kTwoTo25 + 1), true, false, ""},
		geTestCase{int32(kTwoTo25 + 2), true, false, ""},

		geTestCase{int64(-1), false, false, ""},
		geTestCase{int64(kTwoTo25 + 0), false, false, ""},
		geTestCase{int64(kTwoTo25 + 1), true, false, ""},
		geTestCase{int64(kTwoTo25 + 2), true, false, ""},

		// Unsigned integers.
		geTestCase{uint(0), false, false, ""},
		geTestCase{uint(kTwoTo25 + 0), false, false, ""},
		geTestCase{uint(kTwoTo25 + 1), true, false, ""},
		geTestCase{uint(kTwoTo25 + 2), true, false, ""},

		geTestCase{uint8(0), false, false, ""},
		geTestCase{uint8(255), false, false, ""},

		geTestCase{uint16(0), false, false, ""},
		geTestCase{uint16(65535), false, false, ""},

		geTestCase{uint32(0), false, false, ""},
		geTestCase{uint32(kTwoTo25 + 0), false, false, ""},
		geTestCase{uint32(kTwoTo25 + 1), true, false, ""},
		geTestCase{uint32(kTwoTo25 + 2), true, false, ""},

		geTestCase{uint64(0), false, false, ""},
		geTestCase{uint64(kTwoTo25 + 0), false, false, ""},
		geTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		geTestCase{uint64(kTwoTo25 + 2), true, false, ""},

		// Floating point.
		geTestCase{float32(-1), false, false, ""},
		geTestCase{float32(kTwoTo25 - 2), false, false, ""},
		geTestCase{float32(kTwoTo25 - 1), true, false, ""},
		geTestCase{float32(kTwoTo25 + 0), true, false, ""},
		geTestCase{float32(kTwoTo25 + 1), true, false, ""},
		geTestCase{float32(kTwoTo25 + 2), true, false, ""},
		geTestCase{float32(kTwoTo25 + 3), true, false, ""},

		geTestCase{float64(-1), false, false, ""},
		geTestCase{float64(kTwoTo25 - 2), false, false, ""},
		geTestCase{float64(kTwoTo25 - 1), false, false, ""},
		geTestCase{float64(kTwoTo25 + 0), false, false, ""},
		geTestCase{float64(kTwoTo25 + 1), true, false, ""},
		geTestCase{float64(kTwoTo25 + 2), true, false, ""},
		geTestCase{float64(kTwoTo25 + 3), true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) Uint64NotExactlyRepresentableByDoublePrecision() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := GreaterOrEqual(uint64(kTwoTo54 + 1))

	desc := matcher.Description()
	expectedDesc := "greater than or equal to 18014398509481985"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		// Signed integers.
		geTestCase{-1, false, false, ""},
		geTestCase{1 << 30, false, false, ""},

		geTestCase{int(-1), false, false, ""},
		geTestCase{int(math.MaxInt32), false, false, ""},

		geTestCase{int8(-1), false, false, ""},
		geTestCase{int8(127), false, false, ""},

		geTestCase{int16(-1), false, false, ""},
		geTestCase{int16(0), false, false, ""},
		geTestCase{int16(32767), false, false, ""},

		geTestCase{int32(-1), false, false, ""},
		geTestCase{int32(math.MaxInt32), false, false, ""},

		geTestCase{int64(-1), false, false, ""},
		geTestCase{int64(kTwoTo54 - 1), false, false, ""},
		geTestCase{int64(kTwoTo54 + 0), false, false, ""},
		geTestCase{int64(kTwoTo54 + 1), true, false, ""},
		geTestCase{int64(kTwoTo54 + 2), true, false, ""},

		// Unsigned integers.
		geTestCase{uint(0), false, false, ""},
		geTestCase{uint(math.MaxUint32), false, false, ""},

		geTestCase{uint8(0), false, false, ""},
		geTestCase{uint8(255), false, false, ""},

		geTestCase{uint16(0), false, false, ""},
		geTestCase{uint16(65535), false, false, ""},

		geTestCase{uint32(0), false, false, ""},
		geTestCase{uint32(math.MaxUint32), false, false, ""},

		geTestCase{uint64(0), false, false, ""},
		geTestCase{uint64(kTwoTo54 - 1), false, false, ""},
		geTestCase{uint64(kTwoTo54 + 0), false, false, ""},
		geTestCase{uint64(kTwoTo54 + 1), true, false, ""},
		geTestCase{uint64(kTwoTo54 + 2), true, false, ""},

		// Floating point.
		geTestCase{float64(-1), false, false, ""},
		geTestCase{float64(kTwoTo54 - 2), false, false, ""},
		geTestCase{float64(kTwoTo54 - 1), true, false, ""},
		geTestCase{float64(kTwoTo54 + 0), true, false, ""},
		geTestCase{float64(kTwoTo54 + 1), true, false, ""},
		geTestCase{float64(kTwoTo54 + 2), true, false, ""},
		geTestCase{float64(kTwoTo54 + 3), true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) Float32AboveExactIntegerRange() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := GreaterOrEqual(float32(kTwoTo25 + 1))

	desc := matcher.Description()
	expectedDesc := "greater than or equal to 3.3554432e+07"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		// Signed integers.
		geTestCase{int64(-1), false, false, ""},
		geTestCase{int64(kTwoTo25 - 2), false, false, ""},
		geTestCase{int64(kTwoTo25 - 1), true, false, ""},
		geTestCase{int64(kTwoTo25 + 0), true, false, ""},
		geTestCase{int64(kTwoTo25 + 1), true, false, ""},
		geTestCase{int64(kTwoTo25 + 2), true, false, ""},
		geTestCase{int64(kTwoTo25 + 3), true, false, ""},

		// Unsigned integers.
		geTestCase{uint64(0), false, false, ""},
		geTestCase{uint64(kTwoTo25 - 2), false, false, ""},
		geTestCase{uint64(kTwoTo25 - 1), true, false, ""},
		geTestCase{uint64(kTwoTo25 + 0), true, false, ""},
		geTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		geTestCase{uint64(kTwoTo25 + 2), true, false, ""},
		geTestCase{uint64(kTwoTo25 + 3), true, false, ""},

		// Floating point.
		geTestCase{float32(-1), false, false, ""},
		geTestCase{float32(kTwoTo25 - 2), false, false, ""},
		geTestCase{float32(kTwoTo25 - 1), true, false, ""},
		geTestCase{float32(kTwoTo25 + 0), true, false, ""},
		geTestCase{float32(kTwoTo25 + 1), true, false, ""},
		geTestCase{float32(kTwoTo25 + 2), true, false, ""},
		geTestCase{float32(kTwoTo25 + 3), true, false, ""},

		geTestCase{float64(-1), false, false, ""},
		geTestCase{float64(kTwoTo25 - 2), false, false, ""},
		geTestCase{float64(kTwoTo25 - 1), true, false, ""},
		geTestCase{float64(kTwoTo25 + 0), true, false, ""},
		geTestCase{float64(kTwoTo25 + 1), true, false, ""},
		geTestCase{float64(kTwoTo25 + 2), true, false, ""},
		geTestCase{float64(kTwoTo25 + 3), true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) Float64AboveExactIntegerRange() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := GreaterOrEqual(float64(kTwoTo54 + 1))

	desc := matcher.Description()
	expectedDesc := "greater than or equal to 1.8014398509481984e+16"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		// Signed integers.
		geTestCase{int64(-1), false, false, ""},
		geTestCase{int64(kTwoTo54 - 2), false, false, ""},
		geTestCase{int64(kTwoTo54 - 1), true, false, ""},
		geTestCase{int64(kTwoTo54 + 0), true, false, ""},
		geTestCase{int64(kTwoTo54 + 1), true, false, ""},
		geTestCase{int64(kTwoTo54 + 2), true, false, ""},
		geTestCase{int64(kTwoTo54 + 3), true, false, ""},

		// Unsigned integers.
		geTestCase{uint64(0), false, false, ""},
		geTestCase{uint64(kTwoTo54 - 2), false, false, ""},
		geTestCase{uint64(kTwoTo54 - 1), true, false, ""},
		geTestCase{uint64(kTwoTo54 + 0), true, false, ""},
		geTestCase{uint64(kTwoTo54 + 1), true, false, ""},
		geTestCase{uint64(kTwoTo54 + 2), true, false, ""},
		geTestCase{uint64(kTwoTo54 + 3), true, false, ""},

		// Floating point.
		geTestCase{float64(-1), false, false, ""},
		geTestCase{float64(kTwoTo54 - 2), false, false, ""},
		geTestCase{float64(kTwoTo54 - 1), true, false, ""},
		geTestCase{float64(kTwoTo54 + 0), true, false, ""},
		geTestCase{float64(kTwoTo54 + 1), true, false, ""},
		geTestCase{float64(kTwoTo54 + 2), true, false, ""},
		geTestCase{float64(kTwoTo54 + 3), true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// String literals
////////////////////////////////////////////////////////////////////////

func (t *GreaterOrEqualTest) EmptyString() {
	matcher := GreaterOrEqual("")
	desc := matcher.Description()
	expectedDesc := "greater than or equal to \"\""

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		geTestCase{"", true, false, ""},
		geTestCase{"\x00", true, false, ""},
		geTestCase{"a", true, false, ""},
		geTestCase{"foo", true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) SingleNullByte() {
	matcher := GreaterOrEqual("\x00")
	desc := matcher.Description()
	expectedDesc := "greater than or equal to \"\x00\""

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		geTestCase{"", false, false, ""},
		geTestCase{"\x00", true, false, ""},
		geTestCase{"a", true, false, ""},
		geTestCase{"foo", true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *GreaterOrEqualTest) LongerString() {
	matcher := GreaterOrEqual("foo\x00")
	desc := matcher.Description()
	expectedDesc := "greater than or equal to \"foo\x00\""

	ExpectThat(desc, Equals(expectedDesc))

	cases := []geTestCase{
		geTestCase{"", false, false, ""},
		geTestCase{"\x00", false, false, ""},
		geTestCase{"bar", false, false, ""},
		geTestCase{"foo", false, false, ""},
		geTestCase{"foo\x00", true, false, ""},
		geTestCase{"fooa", true, false, ""},
		geTestCase{"qux", true, false, ""},
	}

	t.checkTestCases(matcher, cases)
}
