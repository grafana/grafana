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
	. "github.com/smartystreets/goconvey/convey/assertions/oglematchers"
	. "github.com/smartystreets/goconvey/convey/assertions/ogletest"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type LessOrEqualTest struct {
}

func init() { RegisterTestSuite(&LessOrEqualTest{}) }

type leTestCase struct {
	candidate      interface{}
	expectedResult bool
	shouldBeFatal  bool
	expectedError  string
}

func (t *LessOrEqualTest) checkTestCases(matcher Matcher, cases []leTestCase) {
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

func (t *LessOrEqualTest) IntegerCandidateBadTypes() {
	matcher := LessOrEqual(int(-150))

	cases := []leTestCase{
		leTestCase{true, false, true, "which is not comparable"},
		leTestCase{uintptr(17), false, true, "which is not comparable"},
		leTestCase{complex64(-151), false, true, "which is not comparable"},
		leTestCase{complex128(-151), false, true, "which is not comparable"},
		leTestCase{[...]int{-151}, false, true, "which is not comparable"},
		leTestCase{make(chan int), false, true, "which is not comparable"},
		leTestCase{func() {}, false, true, "which is not comparable"},
		leTestCase{map[int]int{}, false, true, "which is not comparable"},
		leTestCase{&leTestCase{}, false, true, "which is not comparable"},
		leTestCase{make([]int, 0), false, true, "which is not comparable"},
		leTestCase{"-151", false, true, "which is not comparable"},
		leTestCase{leTestCase{}, false, true, "which is not comparable"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) FloatCandidateBadTypes() {
	matcher := LessOrEqual(float32(-150))

	cases := []leTestCase{
		leTestCase{true, false, true, "which is not comparable"},
		leTestCase{uintptr(17), false, true, "which is not comparable"},
		leTestCase{complex64(-151), false, true, "which is not comparable"},
		leTestCase{complex128(-151), false, true, "which is not comparable"},
		leTestCase{[...]int{-151}, false, true, "which is not comparable"},
		leTestCase{make(chan int), false, true, "which is not comparable"},
		leTestCase{func() {}, false, true, "which is not comparable"},
		leTestCase{map[int]int{}, false, true, "which is not comparable"},
		leTestCase{&leTestCase{}, false, true, "which is not comparable"},
		leTestCase{make([]int, 0), false, true, "which is not comparable"},
		leTestCase{"-151", false, true, "which is not comparable"},
		leTestCase{leTestCase{}, false, true, "which is not comparable"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) StringCandidateBadTypes() {
	matcher := LessOrEqual("17")

	cases := []leTestCase{
		leTestCase{true, false, true, "which is not comparable"},
		leTestCase{int(0), false, true, "which is not comparable"},
		leTestCase{int8(0), false, true, "which is not comparable"},
		leTestCase{int16(0), false, true, "which is not comparable"},
		leTestCase{int32(0), false, true, "which is not comparable"},
		leTestCase{int64(0), false, true, "which is not comparable"},
		leTestCase{uint(0), false, true, "which is not comparable"},
		leTestCase{uint8(0), false, true, "which is not comparable"},
		leTestCase{uint16(0), false, true, "which is not comparable"},
		leTestCase{uint32(0), false, true, "which is not comparable"},
		leTestCase{uint64(0), false, true, "which is not comparable"},
		leTestCase{uintptr(17), false, true, "which is not comparable"},
		leTestCase{float32(0), false, true, "which is not comparable"},
		leTestCase{float64(0), false, true, "which is not comparable"},
		leTestCase{complex64(-151), false, true, "which is not comparable"},
		leTestCase{complex128(-151), false, true, "which is not comparable"},
		leTestCase{[...]int{-151}, false, true, "which is not comparable"},
		leTestCase{make(chan int), false, true, "which is not comparable"},
		leTestCase{func() {}, false, true, "which is not comparable"},
		leTestCase{map[int]int{}, false, true, "which is not comparable"},
		leTestCase{&leTestCase{}, false, true, "which is not comparable"},
		leTestCase{make([]int, 0), false, true, "which is not comparable"},
		leTestCase{leTestCase{}, false, true, "which is not comparable"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) BadArgument() {
	panicked := false

	defer func() {
		ExpectThat(panicked, Equals(true))
	}()

	defer func() {
		if r := recover(); r != nil {
			panicked = true
		}
	}()

	LessOrEqual(complex128(0))
}

////////////////////////////////////////////////////////////////////////
// Integer literals
////////////////////////////////////////////////////////////////////////

func (t *LessOrEqualTest) NegativeIntegerLiteral() {
	matcher := LessOrEqual(-150)
	desc := matcher.Description()
	expectedDesc := "less than or equal to -150"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		// Signed integers.
		leTestCase{-(1 << 30), true, false, ""},
		leTestCase{-151, true, false, ""},
		leTestCase{-150, true, false, ""},
		leTestCase{-149, false, false, ""},
		leTestCase{0, false, false, ""},
		leTestCase{17, false, false, ""},

		leTestCase{int(-(1 << 30)), true, false, ""},
		leTestCase{int(-151), true, false, ""},
		leTestCase{int(-150), true, false, ""},
		leTestCase{int(-149), false, false, ""},
		leTestCase{int(0), false, false, ""},
		leTestCase{int(17), false, false, ""},

		leTestCase{int8(-127), false, false, ""},
		leTestCase{int8(0), false, false, ""},
		leTestCase{int8(17), false, false, ""},

		leTestCase{int16(-(1 << 14)), true, false, ""},
		leTestCase{int16(-151), true, false, ""},
		leTestCase{int16(-150), true, false, ""},
		leTestCase{int16(-149), false, false, ""},
		leTestCase{int16(0), false, false, ""},
		leTestCase{int16(17), false, false, ""},

		leTestCase{int32(-(1 << 30)), true, false, ""},
		leTestCase{int32(-151), true, false, ""},
		leTestCase{int32(-150), true, false, ""},
		leTestCase{int32(-149), false, false, ""},
		leTestCase{int32(0), false, false, ""},
		leTestCase{int32(17), false, false, ""},

		leTestCase{int64(-(1 << 30)), true, false, ""},
		leTestCase{int64(-151), true, false, ""},
		leTestCase{int64(-150), true, false, ""},
		leTestCase{int64(-149), false, false, ""},
		leTestCase{int64(0), false, false, ""},
		leTestCase{int64(17), false, false, ""},

		// Unsigned integers.
		leTestCase{uint((1 << 32) - 151), false, false, ""},
		leTestCase{uint(0), false, false, ""},
		leTestCase{uint(17), false, false, ""},

		leTestCase{uint8(0), false, false, ""},
		leTestCase{uint8(17), false, false, ""},
		leTestCase{uint8(253), false, false, ""},

		leTestCase{uint16((1 << 16) - 151), false, false, ""},
		leTestCase{uint16(0), false, false, ""},
		leTestCase{uint16(17), false, false, ""},

		leTestCase{uint32((1 << 32) - 151), false, false, ""},
		leTestCase{uint32(0), false, false, ""},
		leTestCase{uint32(17), false, false, ""},

		leTestCase{uint64((1 << 64) - 151), false, false, ""},
		leTestCase{uint64(0), false, false, ""},
		leTestCase{uint64(17), false, false, ""},

		// Floating point.
		leTestCase{float32(-(1 << 30)), true, false, ""},
		leTestCase{float32(-151), true, false, ""},
		leTestCase{float32(-150.1), true, false, ""},
		leTestCase{float32(-150), true, false, ""},
		leTestCase{float32(-149.9), false, false, ""},
		leTestCase{float32(0), false, false, ""},
		leTestCase{float32(17), false, false, ""},
		leTestCase{float32(160), false, false, ""},

		leTestCase{float64(-(1 << 30)), true, false, ""},
		leTestCase{float64(-151), true, false, ""},
		leTestCase{float64(-150.1), true, false, ""},
		leTestCase{float64(-150), true, false, ""},
		leTestCase{float64(-149.9), false, false, ""},
		leTestCase{float64(0), false, false, ""},
		leTestCase{float64(17), false, false, ""},
		leTestCase{float64(160), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) ZeroIntegerLiteral() {
	matcher := LessOrEqual(0)
	desc := matcher.Description()
	expectedDesc := "less than or equal to 0"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		// Signed integers.
		leTestCase{-(1 << 30), true, false, ""},
		leTestCase{-1, true, false, ""},
		leTestCase{0, true, false, ""},
		leTestCase{1, false, false, ""},
		leTestCase{17, false, false, ""},
		leTestCase{(1 << 30), false, false, ""},

		leTestCase{int(-(1 << 30)), true, false, ""},
		leTestCase{int(-1), true, false, ""},
		leTestCase{int(0), true, false, ""},
		leTestCase{int(1), false, false, ""},
		leTestCase{int(17), false, false, ""},

		leTestCase{int8(-1), true, false, ""},
		leTestCase{int8(0), true, false, ""},
		leTestCase{int8(1), false, false, ""},

		leTestCase{int16(-(1 << 14)), true, false, ""},
		leTestCase{int16(-1), true, false, ""},
		leTestCase{int16(0), true, false, ""},
		leTestCase{int16(1), false, false, ""},
		leTestCase{int16(17), false, false, ""},

		leTestCase{int32(-(1 << 30)), true, false, ""},
		leTestCase{int32(-1), true, false, ""},
		leTestCase{int32(0), true, false, ""},
		leTestCase{int32(1), false, false, ""},
		leTestCase{int32(17), false, false, ""},

		leTestCase{int64(-(1 << 30)), true, false, ""},
		leTestCase{int64(-1), true, false, ""},
		leTestCase{int64(0), true, false, ""},
		leTestCase{int64(1), false, false, ""},
		leTestCase{int64(17), false, false, ""},

		// Unsigned integers.
		leTestCase{uint((1 << 32) - 1), false, false, ""},
		leTestCase{uint(0), true, false, ""},
		leTestCase{uint(1), false, false, ""},
		leTestCase{uint(17), false, false, ""},

		leTestCase{uint8(0), true, false, ""},
		leTestCase{uint8(1), false, false, ""},
		leTestCase{uint8(17), false, false, ""},
		leTestCase{uint8(253), false, false, ""},

		leTestCase{uint16((1 << 16) - 1), false, false, ""},
		leTestCase{uint16(0), true, false, ""},
		leTestCase{uint16(1), false, false, ""},
		leTestCase{uint16(17), false, false, ""},

		leTestCase{uint32((1 << 32) - 1), false, false, ""},
		leTestCase{uint32(0), true, false, ""},
		leTestCase{uint32(1), false, false, ""},
		leTestCase{uint32(17), false, false, ""},

		leTestCase{uint64((1 << 64) - 1), false, false, ""},
		leTestCase{uint64(0), true, false, ""},
		leTestCase{uint64(1), false, false, ""},
		leTestCase{uint64(17), false, false, ""},

		// Floating point.
		leTestCase{float32(-(1 << 30)), true, false, ""},
		leTestCase{float32(-1), true, false, ""},
		leTestCase{float32(-0.1), true, false, ""},
		leTestCase{float32(-0.0), true, false, ""},
		leTestCase{float32(0), true, false, ""},
		leTestCase{float32(0.1), false, false, ""},
		leTestCase{float32(17), false, false, ""},
		leTestCase{float32(160), false, false, ""},

		leTestCase{float64(-(1 << 30)), true, false, ""},
		leTestCase{float64(-1), true, false, ""},
		leTestCase{float64(-0.1), true, false, ""},
		leTestCase{float64(-0), true, false, ""},
		leTestCase{float64(0), true, false, ""},
		leTestCase{float64(0.1), false, false, ""},
		leTestCase{float64(17), false, false, ""},
		leTestCase{float64(160), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) PositiveIntegerLiteral() {
	matcher := LessOrEqual(150)
	desc := matcher.Description()
	expectedDesc := "less than or equal to 150"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		// Signed integers.
		leTestCase{-1, true, false, ""},
		leTestCase{149, true, false, ""},
		leTestCase{150, true, false, ""},
		leTestCase{151, false, false, ""},

		leTestCase{int(-1), true, false, ""},
		leTestCase{int(149), true, false, ""},
		leTestCase{int(150), true, false, ""},
		leTestCase{int(151), false, false, ""},

		leTestCase{int8(-1), true, false, ""},
		leTestCase{int8(0), true, false, ""},
		leTestCase{int8(17), true, false, ""},
		leTestCase{int8(127), true, false, ""},

		leTestCase{int16(-1), true, false, ""},
		leTestCase{int16(149), true, false, ""},
		leTestCase{int16(150), true, false, ""},
		leTestCase{int16(151), false, false, ""},

		leTestCase{int32(-1), true, false, ""},
		leTestCase{int32(149), true, false, ""},
		leTestCase{int32(150), true, false, ""},
		leTestCase{int32(151), false, false, ""},

		leTestCase{int64(-1), true, false, ""},
		leTestCase{int64(149), true, false, ""},
		leTestCase{int64(150), true, false, ""},
		leTestCase{int64(151), false, false, ""},

		// Unsigned integers.
		leTestCase{uint(0), true, false, ""},
		leTestCase{uint(149), true, false, ""},
		leTestCase{uint(150), true, false, ""},
		leTestCase{uint(151), false, false, ""},

		leTestCase{uint8(0), true, false, ""},
		leTestCase{uint8(127), true, false, ""},

		leTestCase{uint16(0), true, false, ""},
		leTestCase{uint16(149), true, false, ""},
		leTestCase{uint16(150), true, false, ""},
		leTestCase{uint16(151), false, false, ""},

		leTestCase{uint32(0), true, false, ""},
		leTestCase{uint32(149), true, false, ""},
		leTestCase{uint32(150), true, false, ""},
		leTestCase{uint32(151), false, false, ""},

		leTestCase{uint64(0), true, false, ""},
		leTestCase{uint64(149), true, false, ""},
		leTestCase{uint64(150), true, false, ""},
		leTestCase{uint64(151), false, false, ""},

		// Floating point.
		leTestCase{float32(-1), true, false, ""},
		leTestCase{float32(149), true, false, ""},
		leTestCase{float32(149.9), true, false, ""},
		leTestCase{float32(150), true, false, ""},
		leTestCase{float32(150.1), false, false, ""},
		leTestCase{float32(151), false, false, ""},

		leTestCase{float64(-1), true, false, ""},
		leTestCase{float64(149), true, false, ""},
		leTestCase{float64(149.9), true, false, ""},
		leTestCase{float64(150), true, false, ""},
		leTestCase{float64(150.1), false, false, ""},
		leTestCase{float64(151), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// Float literals
////////////////////////////////////////////////////////////////////////

func (t *LessOrEqualTest) NegativeFloatLiteral() {
	matcher := LessOrEqual(-150.1)
	desc := matcher.Description()
	expectedDesc := "less than or equal to -150.1"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		// Signed integers.
		leTestCase{-(1 << 30), true, false, ""},
		leTestCase{-151, true, false, ""},
		leTestCase{-150.1, true, false, ""},
		leTestCase{-150, false, false, ""},
		leTestCase{-149, false, false, ""},
		leTestCase{0, false, false, ""},
		leTestCase{17, false, false, ""},

		leTestCase{int(-(1 << 30)), true, false, ""},
		leTestCase{int(-151), true, false, ""},
		leTestCase{int(-150), false, false, ""},
		leTestCase{int(-149), false, false, ""},
		leTestCase{int(0), false, false, ""},
		leTestCase{int(17), false, false, ""},

		leTestCase{int8(-127), false, false, ""},
		leTestCase{int8(0), false, false, ""},
		leTestCase{int8(17), false, false, ""},

		leTestCase{int16(-(1 << 14)), true, false, ""},
		leTestCase{int16(-151), true, false, ""},
		leTestCase{int16(-150), false, false, ""},
		leTestCase{int16(-149), false, false, ""},
		leTestCase{int16(0), false, false, ""},
		leTestCase{int16(17), false, false, ""},

		leTestCase{int32(-(1 << 30)), true, false, ""},
		leTestCase{int32(-151), true, false, ""},
		leTestCase{int32(-150), false, false, ""},
		leTestCase{int32(-149), false, false, ""},
		leTestCase{int32(0), false, false, ""},
		leTestCase{int32(17), false, false, ""},

		leTestCase{int64(-(1 << 30)), true, false, ""},
		leTestCase{int64(-151), true, false, ""},
		leTestCase{int64(-150), false, false, ""},
		leTestCase{int64(-149), false, false, ""},
		leTestCase{int64(0), false, false, ""},
		leTestCase{int64(17), false, false, ""},

		// Unsigned integers.
		leTestCase{uint((1 << 32) - 151), false, false, ""},
		leTestCase{uint(0), false, false, ""},
		leTestCase{uint(17), false, false, ""},

		leTestCase{uint8(0), false, false, ""},
		leTestCase{uint8(17), false, false, ""},
		leTestCase{uint8(253), false, false, ""},

		leTestCase{uint16((1 << 16) - 151), false, false, ""},
		leTestCase{uint16(0), false, false, ""},
		leTestCase{uint16(17), false, false, ""},

		leTestCase{uint32((1 << 32) - 151), false, false, ""},
		leTestCase{uint32(0), false, false, ""},
		leTestCase{uint32(17), false, false, ""},

		leTestCase{uint64((1 << 64) - 151), false, false, ""},
		leTestCase{uint64(0), false, false, ""},
		leTestCase{uint64(17), false, false, ""},

		// Floating point.
		leTestCase{float32(-(1 << 30)), true, false, ""},
		leTestCase{float32(-151), true, false, ""},
		leTestCase{float32(-150.2), true, false, ""},
		leTestCase{float32(-150.1), true, false, ""},
		leTestCase{float32(-150), false, false, ""},
		leTestCase{float32(0), false, false, ""},
		leTestCase{float32(17), false, false, ""},
		leTestCase{float32(160), false, false, ""},

		leTestCase{float64(-(1 << 30)), true, false, ""},
		leTestCase{float64(-151), true, false, ""},
		leTestCase{float64(-150.2), true, false, ""},
		leTestCase{float64(-150.1), true, false, ""},
		leTestCase{float64(-150), false, false, ""},
		leTestCase{float64(0), false, false, ""},
		leTestCase{float64(17), false, false, ""},
		leTestCase{float64(160), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) PositiveFloatLiteral() {
	matcher := LessOrEqual(149.9)
	desc := matcher.Description()
	expectedDesc := "less than or equal to 149.9"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		// Signed integers.
		leTestCase{-1, true, false, ""},
		leTestCase{149, true, false, ""},
		leTestCase{149.9, true, false, ""},
		leTestCase{150, false, false, ""},
		leTestCase{151, false, false, ""},

		leTestCase{int(-1), true, false, ""},
		leTestCase{int(149), true, false, ""},
		leTestCase{int(150), false, false, ""},
		leTestCase{int(151), false, false, ""},

		leTestCase{int8(-1), true, false, ""},
		leTestCase{int8(0), true, false, ""},
		leTestCase{int8(17), true, false, ""},
		leTestCase{int8(127), true, false, ""},

		leTestCase{int16(-1), true, false, ""},
		leTestCase{int16(149), true, false, ""},
		leTestCase{int16(150), false, false, ""},
		leTestCase{int16(151), false, false, ""},

		leTestCase{int32(-1), true, false, ""},
		leTestCase{int32(149), true, false, ""},
		leTestCase{int32(150), false, false, ""},
		leTestCase{int32(151), false, false, ""},

		leTestCase{int64(-1), true, false, ""},
		leTestCase{int64(149), true, false, ""},
		leTestCase{int64(150), false, false, ""},
		leTestCase{int64(151), false, false, ""},

		// Unsigned integers.
		leTestCase{uint(0), true, false, ""},
		leTestCase{uint(149), true, false, ""},
		leTestCase{uint(150), false, false, ""},
		leTestCase{uint(151), false, false, ""},

		leTestCase{uint8(0), true, false, ""},
		leTestCase{uint8(127), true, false, ""},

		leTestCase{uint16(0), true, false, ""},
		leTestCase{uint16(149), true, false, ""},
		leTestCase{uint16(150), false, false, ""},
		leTestCase{uint16(151), false, false, ""},

		leTestCase{uint32(0), true, false, ""},
		leTestCase{uint32(149), true, false, ""},
		leTestCase{uint32(150), false, false, ""},
		leTestCase{uint32(151), false, false, ""},

		leTestCase{uint64(0), true, false, ""},
		leTestCase{uint64(149), true, false, ""},
		leTestCase{uint64(150), false, false, ""},
		leTestCase{uint64(151), false, false, ""},

		// Floating point.
		leTestCase{float32(-1), true, false, ""},
		leTestCase{float32(149), true, false, ""},
		leTestCase{float32(149.8), true, false, ""},
		leTestCase{float32(149.9), true, false, ""},
		leTestCase{float32(150), false, false, ""},
		leTestCase{float32(151), false, false, ""},

		leTestCase{float64(-1), true, false, ""},
		leTestCase{float64(149), true, false, ""},
		leTestCase{float64(149.8), true, false, ""},
		leTestCase{float64(149.9), true, false, ""},
		leTestCase{float64(150), false, false, ""},
		leTestCase{float64(151), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// Subtle cases
////////////////////////////////////////////////////////////////////////

func (t *LessOrEqualTest) Int64NotExactlyRepresentableBySinglePrecision() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := LessOrEqual(int64(kTwoTo25 + 1))

	desc := matcher.Description()
	expectedDesc := "less than or equal to 33554433"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		// Signed integers.
		leTestCase{-1, true, false, ""},
		leTestCase{kTwoTo25 + 0, true, false, ""},
		leTestCase{kTwoTo25 + 1, true, false, ""},
		leTestCase{kTwoTo25 + 2, false, false, ""},

		leTestCase{int(-1), true, false, ""},
		leTestCase{int(kTwoTo25 + 0), true, false, ""},
		leTestCase{int(kTwoTo25 + 1), true, false, ""},
		leTestCase{int(kTwoTo25 + 2), false, false, ""},

		leTestCase{int8(-1), true, false, ""},
		leTestCase{int8(127), true, false, ""},

		leTestCase{int16(-1), true, false, ""},
		leTestCase{int16(0), true, false, ""},
		leTestCase{int16(32767), true, false, ""},

		leTestCase{int32(-1), true, false, ""},
		leTestCase{int32(kTwoTo25 + 0), true, false, ""},
		leTestCase{int32(kTwoTo25 + 1), true, false, ""},
		leTestCase{int32(kTwoTo25 + 2), false, false, ""},

		leTestCase{int64(-1), true, false, ""},
		leTestCase{int64(kTwoTo25 + 0), true, false, ""},
		leTestCase{int64(kTwoTo25 + 1), true, false, ""},
		leTestCase{int64(kTwoTo25 + 2), false, false, ""},

		// Unsigned integers.
		leTestCase{uint(0), true, false, ""},
		leTestCase{uint(kTwoTo25 + 0), true, false, ""},
		leTestCase{uint(kTwoTo25 + 1), true, false, ""},
		leTestCase{uint(kTwoTo25 + 2), false, false, ""},

		leTestCase{uint8(0), true, false, ""},
		leTestCase{uint8(255), true, false, ""},

		leTestCase{uint16(0), true, false, ""},
		leTestCase{uint16(65535), true, false, ""},

		leTestCase{uint32(0), true, false, ""},
		leTestCase{uint32(kTwoTo25 + 0), true, false, ""},
		leTestCase{uint32(kTwoTo25 + 1), true, false, ""},
		leTestCase{uint32(kTwoTo25 + 2), false, false, ""},

		leTestCase{uint64(0), true, false, ""},
		leTestCase{uint64(kTwoTo25 + 0), true, false, ""},
		leTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		leTestCase{uint64(kTwoTo25 + 2), false, false, ""},

		// Floating point.
		leTestCase{float32(-1), true, false, ""},
		leTestCase{float32(kTwoTo25 - 2), true, false, ""},
		leTestCase{float32(kTwoTo25 - 1), true, false, ""},
		leTestCase{float32(kTwoTo25 + 0), true, false, ""},
		leTestCase{float32(kTwoTo25 + 1), true, false, ""},
		leTestCase{float32(kTwoTo25 + 2), true, false, ""},
		leTestCase{float32(kTwoTo25 + 3), false, false, ""},

		leTestCase{float64(-1), true, false, ""},
		leTestCase{float64(kTwoTo25 - 2), true, false, ""},
		leTestCase{float64(kTwoTo25 - 1), true, false, ""},
		leTestCase{float64(kTwoTo25 + 0), true, false, ""},
		leTestCase{float64(kTwoTo25 + 1), true, false, ""},
		leTestCase{float64(kTwoTo25 + 2), false, false, ""},
		leTestCase{float64(kTwoTo25 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) Int64NotExactlyRepresentableByDoublePrecision() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := LessOrEqual(int64(kTwoTo54 + 1))

	desc := matcher.Description()
	expectedDesc := "less than or equal to 18014398509481985"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		// Signed integers.
		leTestCase{-1, true, false, ""},
		leTestCase{1 << 30, true, false, ""},

		leTestCase{int(-1), true, false, ""},
		leTestCase{int(math.MaxInt32), true, false, ""},

		leTestCase{int8(-1), true, false, ""},
		leTestCase{int8(127), true, false, ""},

		leTestCase{int16(-1), true, false, ""},
		leTestCase{int16(0), true, false, ""},
		leTestCase{int16(32767), true, false, ""},

		leTestCase{int32(-1), true, false, ""},
		leTestCase{int32(math.MaxInt32), true, false, ""},

		leTestCase{int64(-1), true, false, ""},
		leTestCase{int64(kTwoTo54 - 1), true, false, ""},
		leTestCase{int64(kTwoTo54 + 0), true, false, ""},
		leTestCase{int64(kTwoTo54 + 1), true, false, ""},
		leTestCase{int64(kTwoTo54 + 2), false, false, ""},

		// Unsigned integers.
		leTestCase{uint(0), true, false, ""},
		leTestCase{uint(math.MaxUint32), true, false, ""},

		leTestCase{uint8(0), true, false, ""},
		leTestCase{uint8(255), true, false, ""},

		leTestCase{uint16(0), true, false, ""},
		leTestCase{uint16(65535), true, false, ""},

		leTestCase{uint32(0), true, false, ""},
		leTestCase{uint32(math.MaxUint32), true, false, ""},

		leTestCase{uint64(0), true, false, ""},
		leTestCase{uint64(kTwoTo54 - 1), true, false, ""},
		leTestCase{uint64(kTwoTo54 + 0), true, false, ""},
		leTestCase{uint64(kTwoTo54 + 1), true, false, ""},
		leTestCase{uint64(kTwoTo54 + 2), false, false, ""},

		// Floating point.
		leTestCase{float64(-1), true, false, ""},
		leTestCase{float64(kTwoTo54 - 2), true, false, ""},
		leTestCase{float64(kTwoTo54 - 1), true, false, ""},
		leTestCase{float64(kTwoTo54 + 0), true, false, ""},
		leTestCase{float64(kTwoTo54 + 1), true, false, ""},
		leTestCase{float64(kTwoTo54 + 2), true, false, ""},
		leTestCase{float64(kTwoTo54 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) Uint64NotExactlyRepresentableBySinglePrecision() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := LessOrEqual(uint64(kTwoTo25 + 1))

	desc := matcher.Description()
	expectedDesc := "less than or equal to 33554433"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		// Signed integers.
		leTestCase{-1, true, false, ""},
		leTestCase{kTwoTo25 + 0, true, false, ""},
		leTestCase{kTwoTo25 + 1, true, false, ""},
		leTestCase{kTwoTo25 + 2, false, false, ""},

		leTestCase{int(-1), true, false, ""},
		leTestCase{int(kTwoTo25 + 0), true, false, ""},
		leTestCase{int(kTwoTo25 + 1), true, false, ""},
		leTestCase{int(kTwoTo25 + 2), false, false, ""},

		leTestCase{int8(-1), true, false, ""},
		leTestCase{int8(127), true, false, ""},

		leTestCase{int16(-1), true, false, ""},
		leTestCase{int16(0), true, false, ""},
		leTestCase{int16(32767), true, false, ""},

		leTestCase{int32(-1), true, false, ""},
		leTestCase{int32(kTwoTo25 + 0), true, false, ""},
		leTestCase{int32(kTwoTo25 + 1), true, false, ""},
		leTestCase{int32(kTwoTo25 + 2), false, false, ""},

		leTestCase{int64(-1), true, false, ""},
		leTestCase{int64(kTwoTo25 + 0), true, false, ""},
		leTestCase{int64(kTwoTo25 + 1), true, false, ""},
		leTestCase{int64(kTwoTo25 + 2), false, false, ""},

		// Unsigned integers.
		leTestCase{uint(0), true, false, ""},
		leTestCase{uint(kTwoTo25 + 0), true, false, ""},
		leTestCase{uint(kTwoTo25 + 1), true, false, ""},
		leTestCase{uint(kTwoTo25 + 2), false, false, ""},

		leTestCase{uint8(0), true, false, ""},
		leTestCase{uint8(255), true, false, ""},

		leTestCase{uint16(0), true, false, ""},
		leTestCase{uint16(65535), true, false, ""},

		leTestCase{uint32(0), true, false, ""},
		leTestCase{uint32(kTwoTo25 + 0), true, false, ""},
		leTestCase{uint32(kTwoTo25 + 1), true, false, ""},
		leTestCase{uint32(kTwoTo25 + 2), false, false, ""},

		leTestCase{uint64(0), true, false, ""},
		leTestCase{uint64(kTwoTo25 + 0), true, false, ""},
		leTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		leTestCase{uint64(kTwoTo25 + 2), false, false, ""},

		// Floating point.
		leTestCase{float32(-1), true, false, ""},
		leTestCase{float32(kTwoTo25 - 2), true, false, ""},
		leTestCase{float32(kTwoTo25 - 1), true, false, ""},
		leTestCase{float32(kTwoTo25 + 0), true, false, ""},
		leTestCase{float32(kTwoTo25 + 1), true, false, ""},
		leTestCase{float32(kTwoTo25 + 2), true, false, ""},
		leTestCase{float32(kTwoTo25 + 3), false, false, ""},

		leTestCase{float64(-1), true, false, ""},
		leTestCase{float64(kTwoTo25 - 2), true, false, ""},
		leTestCase{float64(kTwoTo25 - 1), true, false, ""},
		leTestCase{float64(kTwoTo25 + 0), true, false, ""},
		leTestCase{float64(kTwoTo25 + 1), true, false, ""},
		leTestCase{float64(kTwoTo25 + 2), false, false, ""},
		leTestCase{float64(kTwoTo25 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) Uint64NotExactlyRepresentableByDoublePrecision() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := LessOrEqual(uint64(kTwoTo54 + 1))

	desc := matcher.Description()
	expectedDesc := "less than or equal to 18014398509481985"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		// Signed integers.
		leTestCase{-1, true, false, ""},
		leTestCase{1 << 30, true, false, ""},

		leTestCase{int(-1), true, false, ""},
		leTestCase{int(math.MaxInt32), true, false, ""},

		leTestCase{int8(-1), true, false, ""},
		leTestCase{int8(127), true, false, ""},

		leTestCase{int16(-1), true, false, ""},
		leTestCase{int16(0), true, false, ""},
		leTestCase{int16(32767), true, false, ""},

		leTestCase{int32(-1), true, false, ""},
		leTestCase{int32(math.MaxInt32), true, false, ""},

		leTestCase{int64(-1), true, false, ""},
		leTestCase{int64(kTwoTo54 - 1), true, false, ""},
		leTestCase{int64(kTwoTo54 + 0), true, false, ""},
		leTestCase{int64(kTwoTo54 + 1), true, false, ""},
		leTestCase{int64(kTwoTo54 + 2), false, false, ""},

		// Unsigned integers.
		leTestCase{uint(0), true, false, ""},
		leTestCase{uint(math.MaxUint32), true, false, ""},

		leTestCase{uint8(0), true, false, ""},
		leTestCase{uint8(255), true, false, ""},

		leTestCase{uint16(0), true, false, ""},
		leTestCase{uint16(65535), true, false, ""},

		leTestCase{uint32(0), true, false, ""},
		leTestCase{uint32(math.MaxUint32), true, false, ""},

		leTestCase{uint64(0), true, false, ""},
		leTestCase{uint64(kTwoTo54 - 1), true, false, ""},
		leTestCase{uint64(kTwoTo54 + 0), true, false, ""},
		leTestCase{uint64(kTwoTo54 + 1), true, false, ""},
		leTestCase{uint64(kTwoTo54 + 2), false, false, ""},

		// Floating point.
		leTestCase{float64(-1), true, false, ""},
		leTestCase{float64(kTwoTo54 - 2), true, false, ""},
		leTestCase{float64(kTwoTo54 - 1), true, false, ""},
		leTestCase{float64(kTwoTo54 + 0), true, false, ""},
		leTestCase{float64(kTwoTo54 + 1), true, false, ""},
		leTestCase{float64(kTwoTo54 + 2), true, false, ""},
		leTestCase{float64(kTwoTo54 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) Float32AboveExactIntegerRange() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := LessOrEqual(float32(kTwoTo25 + 1))

	desc := matcher.Description()
	expectedDesc := "less than or equal to 3.3554432e+07"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		// Signed integers.
		leTestCase{int64(-1), true, false, ""},
		leTestCase{int64(kTwoTo25 - 2), true, false, ""},
		leTestCase{int64(kTwoTo25 - 1), true, false, ""},
		leTestCase{int64(kTwoTo25 + 0), true, false, ""},
		leTestCase{int64(kTwoTo25 + 1), true, false, ""},
		leTestCase{int64(kTwoTo25 + 2), true, false, ""},
		leTestCase{int64(kTwoTo25 + 3), false, false, ""},

		// Unsigned integers.
		leTestCase{uint64(0), true, false, ""},
		leTestCase{uint64(kTwoTo25 - 2), true, false, ""},
		leTestCase{uint64(kTwoTo25 - 1), true, false, ""},
		leTestCase{uint64(kTwoTo25 + 0), true, false, ""},
		leTestCase{uint64(kTwoTo25 + 1), true, false, ""},
		leTestCase{uint64(kTwoTo25 + 2), true, false, ""},
		leTestCase{uint64(kTwoTo25 + 3), false, false, ""},

		// Floating point.
		leTestCase{float32(-1), true, false, ""},
		leTestCase{float32(kTwoTo25 - 2), true, false, ""},
		leTestCase{float32(kTwoTo25 - 1), true, false, ""},
		leTestCase{float32(kTwoTo25 + 0), true, false, ""},
		leTestCase{float32(kTwoTo25 + 1), true, false, ""},
		leTestCase{float32(kTwoTo25 + 2), true, false, ""},
		leTestCase{float32(kTwoTo25 + 3), false, false, ""},

		leTestCase{float64(-1), true, false, ""},
		leTestCase{float64(kTwoTo25 - 2), true, false, ""},
		leTestCase{float64(kTwoTo25 - 1), true, false, ""},
		leTestCase{float64(kTwoTo25 + 0), true, false, ""},
		leTestCase{float64(kTwoTo25 + 1), true, false, ""},
		leTestCase{float64(kTwoTo25 + 2), true, false, ""},
		leTestCase{float64(kTwoTo25 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) Float64AboveExactIntegerRange() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := LessOrEqual(float64(kTwoTo54 + 1))

	desc := matcher.Description()
	expectedDesc := "less than or equal to 1.8014398509481984e+16"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		// Signed integers.
		leTestCase{int64(-1), true, false, ""},
		leTestCase{int64(kTwoTo54 - 2), true, false, ""},
		leTestCase{int64(kTwoTo54 - 1), true, false, ""},
		leTestCase{int64(kTwoTo54 + 0), true, false, ""},
		leTestCase{int64(kTwoTo54 + 1), true, false, ""},
		leTestCase{int64(kTwoTo54 + 2), true, false, ""},
		leTestCase{int64(kTwoTo54 + 3), false, false, ""},

		// Unsigned integers.
		leTestCase{uint64(0), true, false, ""},
		leTestCase{uint64(kTwoTo54 - 2), true, false, ""},
		leTestCase{uint64(kTwoTo54 - 1), true, false, ""},
		leTestCase{uint64(kTwoTo54 + 0), true, false, ""},
		leTestCase{uint64(kTwoTo54 + 1), true, false, ""},
		leTestCase{uint64(kTwoTo54 + 2), true, false, ""},
		leTestCase{uint64(kTwoTo54 + 3), false, false, ""},

		// Floating point.
		leTestCase{float64(-1), true, false, ""},
		leTestCase{float64(kTwoTo54 - 2), true, false, ""},
		leTestCase{float64(kTwoTo54 - 1), true, false, ""},
		leTestCase{float64(kTwoTo54 + 0), true, false, ""},
		leTestCase{float64(kTwoTo54 + 1), true, false, ""},
		leTestCase{float64(kTwoTo54 + 2), true, false, ""},
		leTestCase{float64(kTwoTo54 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// String literals
////////////////////////////////////////////////////////////////////////

func (t *LessOrEqualTest) EmptyString() {
	matcher := LessOrEqual("")
	desc := matcher.Description()
	expectedDesc := "less than or equal to \"\""

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		leTestCase{"", true, false, ""},
		leTestCase{"\x00", false, false, ""},
		leTestCase{"a", false, false, ""},
		leTestCase{"foo", false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) SingleNullByte() {
	matcher := LessOrEqual("\x00")
	desc := matcher.Description()
	expectedDesc := "less than or equal to \"\x00\""

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		leTestCase{"", true, false, ""},
		leTestCase{"\x00", true, false, ""},
		leTestCase{"\x00\x00", false, false, ""},
		leTestCase{"a", false, false, ""},
		leTestCase{"foo", false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessOrEqualTest) LongerString() {
	matcher := LessOrEqual("foo\x00")
	desc := matcher.Description()
	expectedDesc := "less than or equal to \"foo\x00\""

	ExpectThat(desc, Equals(expectedDesc))

	cases := []leTestCase{
		leTestCase{"", true, false, ""},
		leTestCase{"\x00", true, false, ""},
		leTestCase{"bar", true, false, ""},
		leTestCase{"foo", true, false, ""},
		leTestCase{"foo\x00", true, false, ""},
		leTestCase{"foo\x00\x00", false, false, ""},
		leTestCase{"fooa", false, false, ""},
		leTestCase{"qux", false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}
