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
	. "github.com/smartystreets/assertions/internal/oglematchers"
	. "github.com/smartystreets/assertions/internal/ogletest"
	"math"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type LessThanTest struct {
}

func init() { RegisterTestSuite(&LessThanTest{}) }

type ltTestCase struct {
	candidate      interface{}
	expectedResult bool
	shouldBeFatal  bool
	expectedError  string
}

func (t *LessThanTest) checkTestCases(matcher Matcher, cases []ltTestCase) {
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

func (t *LessThanTest) IntegerCandidateBadTypes() {
	matcher := LessThan(int(-150))

	cases := []ltTestCase{
		ltTestCase{true, false, true, "which is not comparable"},
		ltTestCase{uintptr(17), false, true, "which is not comparable"},
		ltTestCase{complex64(-151), false, true, "which is not comparable"},
		ltTestCase{complex128(-151), false, true, "which is not comparable"},
		ltTestCase{[...]int{-151}, false, true, "which is not comparable"},
		ltTestCase{make(chan int), false, true, "which is not comparable"},
		ltTestCase{func() {}, false, true, "which is not comparable"},
		ltTestCase{map[int]int{}, false, true, "which is not comparable"},
		ltTestCase{&ltTestCase{}, false, true, "which is not comparable"},
		ltTestCase{make([]int, 0), false, true, "which is not comparable"},
		ltTestCase{"-151", false, true, "which is not comparable"},
		ltTestCase{ltTestCase{}, false, true, "which is not comparable"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) FloatCandidateBadTypes() {
	matcher := LessThan(float32(-150))

	cases := []ltTestCase{
		ltTestCase{true, false, true, "which is not comparable"},
		ltTestCase{uintptr(17), false, true, "which is not comparable"},
		ltTestCase{complex64(-151), false, true, "which is not comparable"},
		ltTestCase{complex128(-151), false, true, "which is not comparable"},
		ltTestCase{[...]int{-151}, false, true, "which is not comparable"},
		ltTestCase{make(chan int), false, true, "which is not comparable"},
		ltTestCase{func() {}, false, true, "which is not comparable"},
		ltTestCase{map[int]int{}, false, true, "which is not comparable"},
		ltTestCase{&ltTestCase{}, false, true, "which is not comparable"},
		ltTestCase{make([]int, 0), false, true, "which is not comparable"},
		ltTestCase{"-151", false, true, "which is not comparable"},
		ltTestCase{ltTestCase{}, false, true, "which is not comparable"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) StringCandidateBadTypes() {
	matcher := LessThan("17")

	cases := []ltTestCase{
		ltTestCase{true, false, true, "which is not comparable"},
		ltTestCase{int(0), false, true, "which is not comparable"},
		ltTestCase{int8(0), false, true, "which is not comparable"},
		ltTestCase{int16(0), false, true, "which is not comparable"},
		ltTestCase{int32(0), false, true, "which is not comparable"},
		ltTestCase{int64(0), false, true, "which is not comparable"},
		ltTestCase{uint(0), false, true, "which is not comparable"},
		ltTestCase{uint8(0), false, true, "which is not comparable"},
		ltTestCase{uint16(0), false, true, "which is not comparable"},
		ltTestCase{uint32(0), false, true, "which is not comparable"},
		ltTestCase{uint64(0), false, true, "which is not comparable"},
		ltTestCase{uintptr(17), false, true, "which is not comparable"},
		ltTestCase{float32(0), false, true, "which is not comparable"},
		ltTestCase{float64(0), false, true, "which is not comparable"},
		ltTestCase{complex64(-151), false, true, "which is not comparable"},
		ltTestCase{complex128(-151), false, true, "which is not comparable"},
		ltTestCase{[...]int{-151}, false, true, "which is not comparable"},
		ltTestCase{make(chan int), false, true, "which is not comparable"},
		ltTestCase{func() {}, false, true, "which is not comparable"},
		ltTestCase{map[int]int{}, false, true, "which is not comparable"},
		ltTestCase{&ltTestCase{}, false, true, "which is not comparable"},
		ltTestCase{make([]int, 0), false, true, "which is not comparable"},
		ltTestCase{ltTestCase{}, false, true, "which is not comparable"},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) BadArgument() {
	panicked := false

	defer func() {
		ExpectThat(panicked, Equals(true))
	}()

	defer func() {
		if r := recover(); r != nil {
			panicked = true
		}
	}()

	LessThan(complex128(0))
}

////////////////////////////////////////////////////////////////////////
// Integer literals
////////////////////////////////////////////////////////////////////////

func (t *LessThanTest) NegativeIntegerLiteral() {
	matcher := LessThan(-150)
	desc := matcher.Description()
	expectedDesc := "less than -150"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		// Signed integers.
		ltTestCase{-(1 << 30), true, false, ""},
		ltTestCase{-151, true, false, ""},
		ltTestCase{-150, false, false, ""},
		ltTestCase{0, false, false, ""},
		ltTestCase{17, false, false, ""},

		ltTestCase{int(-(1 << 30)), true, false, ""},
		ltTestCase{int(-151), true, false, ""},
		ltTestCase{int(-150), false, false, ""},
		ltTestCase{int(0), false, false, ""},
		ltTestCase{int(17), false, false, ""},

		ltTestCase{int8(-127), false, false, ""},
		ltTestCase{int8(0), false, false, ""},
		ltTestCase{int8(17), false, false, ""},

		ltTestCase{int16(-(1 << 14)), true, false, ""},
		ltTestCase{int16(-151), true, false, ""},
		ltTestCase{int16(-150), false, false, ""},
		ltTestCase{int16(0), false, false, ""},
		ltTestCase{int16(17), false, false, ""},

		ltTestCase{int32(-(1 << 30)), true, false, ""},
		ltTestCase{int32(-151), true, false, ""},
		ltTestCase{int32(-150), false, false, ""},
		ltTestCase{int32(0), false, false, ""},
		ltTestCase{int32(17), false, false, ""},

		ltTestCase{int64(-(1 << 30)), true, false, ""},
		ltTestCase{int64(-151), true, false, ""},
		ltTestCase{int64(-150), false, false, ""},
		ltTestCase{int64(0), false, false, ""},
		ltTestCase{int64(17), false, false, ""},

		// Unsigned integers.
		ltTestCase{uint((1 << 32) - 151), false, false, ""},
		ltTestCase{uint(0), false, false, ""},
		ltTestCase{uint(17), false, false, ""},

		ltTestCase{uint8(0), false, false, ""},
		ltTestCase{uint8(17), false, false, ""},
		ltTestCase{uint8(253), false, false, ""},

		ltTestCase{uint16((1 << 16) - 151), false, false, ""},
		ltTestCase{uint16(0), false, false, ""},
		ltTestCase{uint16(17), false, false, ""},

		ltTestCase{uint32((1 << 32) - 151), false, false, ""},
		ltTestCase{uint32(0), false, false, ""},
		ltTestCase{uint32(17), false, false, ""},

		ltTestCase{uint64((1 << 64) - 151), false, false, ""},
		ltTestCase{uint64(0), false, false, ""},
		ltTestCase{uint64(17), false, false, ""},

		// Floating point.
		ltTestCase{float32(-(1 << 30)), true, false, ""},
		ltTestCase{float32(-151), true, false, ""},
		ltTestCase{float32(-150.1), true, false, ""},
		ltTestCase{float32(-150), false, false, ""},
		ltTestCase{float32(-149.9), false, false, ""},
		ltTestCase{float32(0), false, false, ""},
		ltTestCase{float32(17), false, false, ""},
		ltTestCase{float32(160), false, false, ""},

		ltTestCase{float64(-(1 << 30)), true, false, ""},
		ltTestCase{float64(-151), true, false, ""},
		ltTestCase{float64(-150.1), true, false, ""},
		ltTestCase{float64(-150), false, false, ""},
		ltTestCase{float64(-149.9), false, false, ""},
		ltTestCase{float64(0), false, false, ""},
		ltTestCase{float64(17), false, false, ""},
		ltTestCase{float64(160), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) ZeroIntegerLiteral() {
	matcher := LessThan(0)
	desc := matcher.Description()
	expectedDesc := "less than 0"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		// Signed integers.
		ltTestCase{-(1 << 30), true, false, ""},
		ltTestCase{-1, true, false, ""},
		ltTestCase{0, false, false, ""},
		ltTestCase{1, false, false, ""},
		ltTestCase{17, false, false, ""},
		ltTestCase{(1 << 30), false, false, ""},

		ltTestCase{int(-(1 << 30)), true, false, ""},
		ltTestCase{int(-1), true, false, ""},
		ltTestCase{int(0), false, false, ""},
		ltTestCase{int(1), false, false, ""},
		ltTestCase{int(17), false, false, ""},

		ltTestCase{int8(-1), true, false, ""},
		ltTestCase{int8(0), false, false, ""},
		ltTestCase{int8(1), false, false, ""},

		ltTestCase{int16(-(1 << 14)), true, false, ""},
		ltTestCase{int16(-1), true, false, ""},
		ltTestCase{int16(0), false, false, ""},
		ltTestCase{int16(1), false, false, ""},
		ltTestCase{int16(17), false, false, ""},

		ltTestCase{int32(-(1 << 30)), true, false, ""},
		ltTestCase{int32(-1), true, false, ""},
		ltTestCase{int32(0), false, false, ""},
		ltTestCase{int32(1), false, false, ""},
		ltTestCase{int32(17), false, false, ""},

		ltTestCase{int64(-(1 << 30)), true, false, ""},
		ltTestCase{int64(-1), true, false, ""},
		ltTestCase{int64(0), false, false, ""},
		ltTestCase{int64(1), false, false, ""},
		ltTestCase{int64(17), false, false, ""},

		// Unsigned integers.
		ltTestCase{uint((1 << 32) - 1), false, false, ""},
		ltTestCase{uint(0), false, false, ""},
		ltTestCase{uint(17), false, false, ""},

		ltTestCase{uint8(0), false, false, ""},
		ltTestCase{uint8(17), false, false, ""},
		ltTestCase{uint8(253), false, false, ""},

		ltTestCase{uint16((1 << 16) - 1), false, false, ""},
		ltTestCase{uint16(0), false, false, ""},
		ltTestCase{uint16(17), false, false, ""},

		ltTestCase{uint32((1 << 32) - 1), false, false, ""},
		ltTestCase{uint32(0), false, false, ""},
		ltTestCase{uint32(17), false, false, ""},

		ltTestCase{uint64((1 << 64) - 1), false, false, ""},
		ltTestCase{uint64(0), false, false, ""},
		ltTestCase{uint64(17), false, false, ""},

		// Floating point.
		ltTestCase{float32(-(1 << 30)), true, false, ""},
		ltTestCase{float32(-1), true, false, ""},
		ltTestCase{float32(-0.1), true, false, ""},
		ltTestCase{float32(-0.0), false, false, ""},
		ltTestCase{float32(0), false, false, ""},
		ltTestCase{float32(0.1), false, false, ""},
		ltTestCase{float32(17), false, false, ""},
		ltTestCase{float32(160), false, false, ""},

		ltTestCase{float64(-(1 << 30)), true, false, ""},
		ltTestCase{float64(-1), true, false, ""},
		ltTestCase{float64(-0.1), true, false, ""},
		ltTestCase{float64(-0), false, false, ""},
		ltTestCase{float64(0), false, false, ""},
		ltTestCase{float64(17), false, false, ""},
		ltTestCase{float64(160), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) PositiveIntegerLiteral() {
	matcher := LessThan(150)
	desc := matcher.Description()
	expectedDesc := "less than 150"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		// Signed integers.
		ltTestCase{-1, true, false, ""},
		ltTestCase{149, true, false, ""},
		ltTestCase{150, false, false, ""},
		ltTestCase{151, false, false, ""},

		ltTestCase{int(-1), true, false, ""},
		ltTestCase{int(149), true, false, ""},
		ltTestCase{int(150), false, false, ""},
		ltTestCase{int(151), false, false, ""},

		ltTestCase{int8(-1), true, false, ""},
		ltTestCase{int8(0), true, false, ""},
		ltTestCase{int8(17), true, false, ""},
		ltTestCase{int8(127), true, false, ""},

		ltTestCase{int16(-1), true, false, ""},
		ltTestCase{int16(149), true, false, ""},
		ltTestCase{int16(150), false, false, ""},
		ltTestCase{int16(151), false, false, ""},

		ltTestCase{int32(-1), true, false, ""},
		ltTestCase{int32(149), true, false, ""},
		ltTestCase{int32(150), false, false, ""},
		ltTestCase{int32(151), false, false, ""},

		ltTestCase{int64(-1), true, false, ""},
		ltTestCase{int64(149), true, false, ""},
		ltTestCase{int64(150), false, false, ""},
		ltTestCase{int64(151), false, false, ""},

		// Unsigned integers.
		ltTestCase{uint(0), true, false, ""},
		ltTestCase{uint(149), true, false, ""},
		ltTestCase{uint(150), false, false, ""},
		ltTestCase{uint(151), false, false, ""},

		ltTestCase{uint8(0), true, false, ""},
		ltTestCase{uint8(127), true, false, ""},

		ltTestCase{uint16(0), true, false, ""},
		ltTestCase{uint16(149), true, false, ""},
		ltTestCase{uint16(150), false, false, ""},
		ltTestCase{uint16(151), false, false, ""},

		ltTestCase{uint32(0), true, false, ""},
		ltTestCase{uint32(149), true, false, ""},
		ltTestCase{uint32(150), false, false, ""},
		ltTestCase{uint32(151), false, false, ""},

		ltTestCase{uint64(0), true, false, ""},
		ltTestCase{uint64(149), true, false, ""},
		ltTestCase{uint64(150), false, false, ""},
		ltTestCase{uint64(151), false, false, ""},

		// Floating point.
		ltTestCase{float32(-1), true, false, ""},
		ltTestCase{float32(149), true, false, ""},
		ltTestCase{float32(149.9), true, false, ""},
		ltTestCase{float32(150), false, false, ""},
		ltTestCase{float32(150.1), false, false, ""},
		ltTestCase{float32(151), false, false, ""},

		ltTestCase{float64(-1), true, false, ""},
		ltTestCase{float64(149), true, false, ""},
		ltTestCase{float64(149.9), true, false, ""},
		ltTestCase{float64(150), false, false, ""},
		ltTestCase{float64(150.1), false, false, ""},
		ltTestCase{float64(151), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// Float literals
////////////////////////////////////////////////////////////////////////

func (t *LessThanTest) NegativeFloatLiteral() {
	matcher := LessThan(-150.1)
	desc := matcher.Description()
	expectedDesc := "less than -150.1"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		// Signed integers.
		ltTestCase{-(1 << 30), true, false, ""},
		ltTestCase{-151, true, false, ""},
		ltTestCase{-150, false, false, ""},
		ltTestCase{0, false, false, ""},
		ltTestCase{17, false, false, ""},

		ltTestCase{int(-(1 << 30)), true, false, ""},
		ltTestCase{int(-151), true, false, ""},
		ltTestCase{int(-150), false, false, ""},
		ltTestCase{int(0), false, false, ""},
		ltTestCase{int(17), false, false, ""},

		ltTestCase{int8(-127), false, false, ""},
		ltTestCase{int8(0), false, false, ""},
		ltTestCase{int8(17), false, false, ""},

		ltTestCase{int16(-(1 << 14)), true, false, ""},
		ltTestCase{int16(-151), true, false, ""},
		ltTestCase{int16(-150), false, false, ""},
		ltTestCase{int16(0), false, false, ""},
		ltTestCase{int16(17), false, false, ""},

		ltTestCase{int32(-(1 << 30)), true, false, ""},
		ltTestCase{int32(-151), true, false, ""},
		ltTestCase{int32(-150), false, false, ""},
		ltTestCase{int32(0), false, false, ""},
		ltTestCase{int32(17), false, false, ""},

		ltTestCase{int64(-(1 << 30)), true, false, ""},
		ltTestCase{int64(-151), true, false, ""},
		ltTestCase{int64(-150), false, false, ""},
		ltTestCase{int64(0), false, false, ""},
		ltTestCase{int64(17), false, false, ""},

		// Unsigned integers.
		ltTestCase{uint((1 << 32) - 151), false, false, ""},
		ltTestCase{uint(0), false, false, ""},
		ltTestCase{uint(17), false, false, ""},

		ltTestCase{uint8(0), false, false, ""},
		ltTestCase{uint8(17), false, false, ""},
		ltTestCase{uint8(253), false, false, ""},

		ltTestCase{uint16((1 << 16) - 151), false, false, ""},
		ltTestCase{uint16(0), false, false, ""},
		ltTestCase{uint16(17), false, false, ""},

		ltTestCase{uint32((1 << 32) - 151), false, false, ""},
		ltTestCase{uint32(0), false, false, ""},
		ltTestCase{uint32(17), false, false, ""},

		ltTestCase{uint64((1 << 64) - 151), false, false, ""},
		ltTestCase{uint64(0), false, false, ""},
		ltTestCase{uint64(17), false, false, ""},

		// Floating point.
		ltTestCase{float32(-(1 << 30)), true, false, ""},
		ltTestCase{float32(-151), true, false, ""},
		ltTestCase{float32(-150.2), true, false, ""},
		ltTestCase{float32(-150.1), false, false, ""},
		ltTestCase{float32(-150), false, false, ""},
		ltTestCase{float32(0), false, false, ""},
		ltTestCase{float32(17), false, false, ""},
		ltTestCase{float32(160), false, false, ""},

		ltTestCase{float64(-(1 << 30)), true, false, ""},
		ltTestCase{float64(-151), true, false, ""},
		ltTestCase{float64(-150.2), true, false, ""},
		ltTestCase{float64(-150.1), false, false, ""},
		ltTestCase{float64(-150), false, false, ""},
		ltTestCase{float64(0), false, false, ""},
		ltTestCase{float64(17), false, false, ""},
		ltTestCase{float64(160), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) PositiveFloatLiteral() {
	matcher := LessThan(149.9)
	desc := matcher.Description()
	expectedDesc := "less than 149.9"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		// Signed integers.
		ltTestCase{-1, true, false, ""},
		ltTestCase{149, true, false, ""},
		ltTestCase{150, false, false, ""},
		ltTestCase{151, false, false, ""},

		ltTestCase{int(-1), true, false, ""},
		ltTestCase{int(149), true, false, ""},
		ltTestCase{int(150), false, false, ""},
		ltTestCase{int(151), false, false, ""},

		ltTestCase{int8(-1), true, false, ""},
		ltTestCase{int8(0), true, false, ""},
		ltTestCase{int8(17), true, false, ""},
		ltTestCase{int8(127), true, false, ""},

		ltTestCase{int16(-1), true, false, ""},
		ltTestCase{int16(149), true, false, ""},
		ltTestCase{int16(150), false, false, ""},
		ltTestCase{int16(151), false, false, ""},

		ltTestCase{int32(-1), true, false, ""},
		ltTestCase{int32(149), true, false, ""},
		ltTestCase{int32(150), false, false, ""},
		ltTestCase{int32(151), false, false, ""},

		ltTestCase{int64(-1), true, false, ""},
		ltTestCase{int64(149), true, false, ""},
		ltTestCase{int64(150), false, false, ""},
		ltTestCase{int64(151), false, false, ""},

		// Unsigned integers.
		ltTestCase{uint(0), true, false, ""},
		ltTestCase{uint(149), true, false, ""},
		ltTestCase{uint(150), false, false, ""},
		ltTestCase{uint(151), false, false, ""},

		ltTestCase{uint8(0), true, false, ""},
		ltTestCase{uint8(127), true, false, ""},

		ltTestCase{uint16(0), true, false, ""},
		ltTestCase{uint16(149), true, false, ""},
		ltTestCase{uint16(150), false, false, ""},
		ltTestCase{uint16(151), false, false, ""},

		ltTestCase{uint32(0), true, false, ""},
		ltTestCase{uint32(149), true, false, ""},
		ltTestCase{uint32(150), false, false, ""},
		ltTestCase{uint32(151), false, false, ""},

		ltTestCase{uint64(0), true, false, ""},
		ltTestCase{uint64(149), true, false, ""},
		ltTestCase{uint64(150), false, false, ""},
		ltTestCase{uint64(151), false, false, ""},

		// Floating point.
		ltTestCase{float32(-1), true, false, ""},
		ltTestCase{float32(149), true, false, ""},
		ltTestCase{float32(149.8), true, false, ""},
		ltTestCase{float32(149.9), false, false, ""},
		ltTestCase{float32(150), false, false, ""},
		ltTestCase{float32(151), false, false, ""},

		ltTestCase{float64(-1), true, false, ""},
		ltTestCase{float64(149), true, false, ""},
		ltTestCase{float64(149.8), true, false, ""},
		ltTestCase{float64(149.9), false, false, ""},
		ltTestCase{float64(150), false, false, ""},
		ltTestCase{float64(151), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// Subtle cases
////////////////////////////////////////////////////////////////////////

func (t *LessThanTest) Int64NotExactlyRepresentableBySinglePrecision() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := LessThan(int64(kTwoTo25 + 1))

	desc := matcher.Description()
	expectedDesc := "less than 33554433"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		// Signed integers.
		ltTestCase{-1, true, false, ""},
		ltTestCase{kTwoTo25 + 0, true, false, ""},
		ltTestCase{kTwoTo25 + 1, false, false, ""},
		ltTestCase{kTwoTo25 + 2, false, false, ""},

		ltTestCase{int(-1), true, false, ""},
		ltTestCase{int(kTwoTo25 + 0), true, false, ""},
		ltTestCase{int(kTwoTo25 + 1), false, false, ""},
		ltTestCase{int(kTwoTo25 + 2), false, false, ""},

		ltTestCase{int8(-1), true, false, ""},
		ltTestCase{int8(127), true, false, ""},

		ltTestCase{int16(-1), true, false, ""},
		ltTestCase{int16(0), true, false, ""},
		ltTestCase{int16(32767), true, false, ""},

		ltTestCase{int32(-1), true, false, ""},
		ltTestCase{int32(kTwoTo25 + 0), true, false, ""},
		ltTestCase{int32(kTwoTo25 + 1), false, false, ""},
		ltTestCase{int32(kTwoTo25 + 2), false, false, ""},

		ltTestCase{int64(-1), true, false, ""},
		ltTestCase{int64(kTwoTo25 + 0), true, false, ""},
		ltTestCase{int64(kTwoTo25 + 1), false, false, ""},
		ltTestCase{int64(kTwoTo25 + 2), false, false, ""},

		// Unsigned integers.
		ltTestCase{uint(0), true, false, ""},
		ltTestCase{uint(kTwoTo25 + 0), true, false, ""},
		ltTestCase{uint(kTwoTo25 + 1), false, false, ""},
		ltTestCase{uint(kTwoTo25 + 2), false, false, ""},

		ltTestCase{uint8(0), true, false, ""},
		ltTestCase{uint8(255), true, false, ""},

		ltTestCase{uint16(0), true, false, ""},
		ltTestCase{uint16(65535), true, false, ""},

		ltTestCase{uint32(0), true, false, ""},
		ltTestCase{uint32(kTwoTo25 + 0), true, false, ""},
		ltTestCase{uint32(kTwoTo25 + 1), false, false, ""},
		ltTestCase{uint32(kTwoTo25 + 2), false, false, ""},

		ltTestCase{uint64(0), true, false, ""},
		ltTestCase{uint64(kTwoTo25 + 0), true, false, ""},
		ltTestCase{uint64(kTwoTo25 + 1), false, false, ""},
		ltTestCase{uint64(kTwoTo25 + 2), false, false, ""},

		// Floating point.
		ltTestCase{float32(-1), true, false, ""},
		ltTestCase{float32(kTwoTo25 - 2), true, false, ""},
		ltTestCase{float32(kTwoTo25 - 1), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 0), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 1), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 2), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 3), false, false, ""},

		ltTestCase{float64(-1), true, false, ""},
		ltTestCase{float64(kTwoTo25 - 2), true, false, ""},
		ltTestCase{float64(kTwoTo25 - 1), true, false, ""},
		ltTestCase{float64(kTwoTo25 + 0), true, false, ""},
		ltTestCase{float64(kTwoTo25 + 1), false, false, ""},
		ltTestCase{float64(kTwoTo25 + 2), false, false, ""},
		ltTestCase{float64(kTwoTo25 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) Int64NotExactlyRepresentableByDoublePrecision() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := LessThan(int64(kTwoTo54 + 1))

	desc := matcher.Description()
	expectedDesc := "less than 18014398509481985"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		// Signed integers.
		ltTestCase{-1, true, false, ""},
		ltTestCase{1 << 30, true, false, ""},

		ltTestCase{int(-1), true, false, ""},
		ltTestCase{int(math.MaxInt32), true, false, ""},

		ltTestCase{int8(-1), true, false, ""},
		ltTestCase{int8(127), true, false, ""},

		ltTestCase{int16(-1), true, false, ""},
		ltTestCase{int16(0), true, false, ""},
		ltTestCase{int16(32767), true, false, ""},

		ltTestCase{int32(-1), true, false, ""},
		ltTestCase{int32(math.MaxInt32), true, false, ""},

		ltTestCase{int64(-1), true, false, ""},
		ltTestCase{int64(kTwoTo54 - 1), true, false, ""},
		ltTestCase{int64(kTwoTo54 + 0), true, false, ""},
		ltTestCase{int64(kTwoTo54 + 1), false, false, ""},
		ltTestCase{int64(kTwoTo54 + 2), false, false, ""},

		// Unsigned integers.
		ltTestCase{uint(0), true, false, ""},
		ltTestCase{uint(math.MaxUint32), true, false, ""},

		ltTestCase{uint8(0), true, false, ""},
		ltTestCase{uint8(255), true, false, ""},

		ltTestCase{uint16(0), true, false, ""},
		ltTestCase{uint16(65535), true, false, ""},

		ltTestCase{uint32(0), true, false, ""},
		ltTestCase{uint32(math.MaxUint32), true, false, ""},

		ltTestCase{uint64(0), true, false, ""},
		ltTestCase{uint64(kTwoTo54 - 1), true, false, ""},
		ltTestCase{uint64(kTwoTo54 + 0), true, false, ""},
		ltTestCase{uint64(kTwoTo54 + 1), false, false, ""},
		ltTestCase{uint64(kTwoTo54 + 2), false, false, ""},

		// Floating point.
		ltTestCase{float64(-1), true, false, ""},
		ltTestCase{float64(kTwoTo54 - 2), true, false, ""},
		ltTestCase{float64(kTwoTo54 - 1), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 0), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 1), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 2), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) Uint64NotExactlyRepresentableBySinglePrecision() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := LessThan(uint64(kTwoTo25 + 1))

	desc := matcher.Description()
	expectedDesc := "less than 33554433"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		// Signed integers.
		ltTestCase{-1, true, false, ""},
		ltTestCase{kTwoTo25 + 0, true, false, ""},
		ltTestCase{kTwoTo25 + 1, false, false, ""},
		ltTestCase{kTwoTo25 + 2, false, false, ""},

		ltTestCase{int(-1), true, false, ""},
		ltTestCase{int(kTwoTo25 + 0), true, false, ""},
		ltTestCase{int(kTwoTo25 + 1), false, false, ""},
		ltTestCase{int(kTwoTo25 + 2), false, false, ""},

		ltTestCase{int8(-1), true, false, ""},
		ltTestCase{int8(127), true, false, ""},

		ltTestCase{int16(-1), true, false, ""},
		ltTestCase{int16(0), true, false, ""},
		ltTestCase{int16(32767), true, false, ""},

		ltTestCase{int32(-1), true, false, ""},
		ltTestCase{int32(kTwoTo25 + 0), true, false, ""},
		ltTestCase{int32(kTwoTo25 + 1), false, false, ""},
		ltTestCase{int32(kTwoTo25 + 2), false, false, ""},

		ltTestCase{int64(-1), true, false, ""},
		ltTestCase{int64(kTwoTo25 + 0), true, false, ""},
		ltTestCase{int64(kTwoTo25 + 1), false, false, ""},
		ltTestCase{int64(kTwoTo25 + 2), false, false, ""},

		// Unsigned integers.
		ltTestCase{uint(0), true, false, ""},
		ltTestCase{uint(kTwoTo25 + 0), true, false, ""},
		ltTestCase{uint(kTwoTo25 + 1), false, false, ""},
		ltTestCase{uint(kTwoTo25 + 2), false, false, ""},

		ltTestCase{uint8(0), true, false, ""},
		ltTestCase{uint8(255), true, false, ""},

		ltTestCase{uint16(0), true, false, ""},
		ltTestCase{uint16(65535), true, false, ""},

		ltTestCase{uint32(0), true, false, ""},
		ltTestCase{uint32(kTwoTo25 + 0), true, false, ""},
		ltTestCase{uint32(kTwoTo25 + 1), false, false, ""},
		ltTestCase{uint32(kTwoTo25 + 2), false, false, ""},

		ltTestCase{uint64(0), true, false, ""},
		ltTestCase{uint64(kTwoTo25 + 0), true, false, ""},
		ltTestCase{uint64(kTwoTo25 + 1), false, false, ""},
		ltTestCase{uint64(kTwoTo25 + 2), false, false, ""},

		// Floating point.
		ltTestCase{float32(-1), true, false, ""},
		ltTestCase{float32(kTwoTo25 - 2), true, false, ""},
		ltTestCase{float32(kTwoTo25 - 1), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 0), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 1), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 2), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 3), false, false, ""},

		ltTestCase{float64(-1), true, false, ""},
		ltTestCase{float64(kTwoTo25 - 2), true, false, ""},
		ltTestCase{float64(kTwoTo25 - 1), true, false, ""},
		ltTestCase{float64(kTwoTo25 + 0), true, false, ""},
		ltTestCase{float64(kTwoTo25 + 1), false, false, ""},
		ltTestCase{float64(kTwoTo25 + 2), false, false, ""},
		ltTestCase{float64(kTwoTo25 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) Uint64NotExactlyRepresentableByDoublePrecision() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := LessThan(uint64(kTwoTo54 + 1))

	desc := matcher.Description()
	expectedDesc := "less than 18014398509481985"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		// Signed integers.
		ltTestCase{-1, true, false, ""},
		ltTestCase{1 << 30, true, false, ""},

		ltTestCase{int(-1), true, false, ""},
		ltTestCase{int(math.MaxInt32), true, false, ""},

		ltTestCase{int8(-1), true, false, ""},
		ltTestCase{int8(127), true, false, ""},

		ltTestCase{int16(-1), true, false, ""},
		ltTestCase{int16(0), true, false, ""},
		ltTestCase{int16(32767), true, false, ""},

		ltTestCase{int32(-1), true, false, ""},
		ltTestCase{int32(math.MaxInt32), true, false, ""},

		ltTestCase{int64(-1), true, false, ""},
		ltTestCase{int64(kTwoTo54 - 1), true, false, ""},
		ltTestCase{int64(kTwoTo54 + 0), true, false, ""},
		ltTestCase{int64(kTwoTo54 + 1), false, false, ""},
		ltTestCase{int64(kTwoTo54 + 2), false, false, ""},

		// Unsigned integers.
		ltTestCase{uint(0), true, false, ""},
		ltTestCase{uint(math.MaxUint32), true, false, ""},

		ltTestCase{uint8(0), true, false, ""},
		ltTestCase{uint8(255), true, false, ""},

		ltTestCase{uint16(0), true, false, ""},
		ltTestCase{uint16(65535), true, false, ""},

		ltTestCase{uint32(0), true, false, ""},
		ltTestCase{uint32(math.MaxUint32), true, false, ""},

		ltTestCase{uint64(0), true, false, ""},
		ltTestCase{uint64(kTwoTo54 - 1), true, false, ""},
		ltTestCase{uint64(kTwoTo54 + 0), true, false, ""},
		ltTestCase{uint64(kTwoTo54 + 1), false, false, ""},
		ltTestCase{uint64(kTwoTo54 + 2), false, false, ""},

		// Floating point.
		ltTestCase{float64(-1), true, false, ""},
		ltTestCase{float64(kTwoTo54 - 2), true, false, ""},
		ltTestCase{float64(kTwoTo54 - 1), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 0), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 1), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 2), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) Float32AboveExactIntegerRange() {
	// Single-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^25-1, 2^25+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo25 = 1 << 25
	matcher := LessThan(float32(kTwoTo25 + 1))

	desc := matcher.Description()
	expectedDesc := "less than 3.3554432e+07"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		// Signed integers.
		ltTestCase{int64(-1), true, false, ""},
		ltTestCase{int64(kTwoTo25 - 2), true, false, ""},
		ltTestCase{int64(kTwoTo25 - 1), false, false, ""},
		ltTestCase{int64(kTwoTo25 + 0), false, false, ""},
		ltTestCase{int64(kTwoTo25 + 1), false, false, ""},
		ltTestCase{int64(kTwoTo25 + 2), false, false, ""},
		ltTestCase{int64(kTwoTo25 + 3), false, false, ""},

		// Unsigned integers.
		ltTestCase{uint64(0), true, false, ""},
		ltTestCase{uint64(kTwoTo25 - 2), true, false, ""},
		ltTestCase{uint64(kTwoTo25 - 1), false, false, ""},
		ltTestCase{uint64(kTwoTo25 + 0), false, false, ""},
		ltTestCase{uint64(kTwoTo25 + 1), false, false, ""},
		ltTestCase{uint64(kTwoTo25 + 2), false, false, ""},
		ltTestCase{uint64(kTwoTo25 + 3), false, false, ""},

		// Floating point.
		ltTestCase{float32(-1), true, false, ""},
		ltTestCase{float32(kTwoTo25 - 2), true, false, ""},
		ltTestCase{float32(kTwoTo25 - 1), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 0), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 1), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 2), false, false, ""},
		ltTestCase{float32(kTwoTo25 + 3), false, false, ""},

		ltTestCase{float64(-1), true, false, ""},
		ltTestCase{float64(kTwoTo25 - 2), true, false, ""},
		ltTestCase{float64(kTwoTo25 - 1), false, false, ""},
		ltTestCase{float64(kTwoTo25 + 0), false, false, ""},
		ltTestCase{float64(kTwoTo25 + 1), false, false, ""},
		ltTestCase{float64(kTwoTo25 + 2), false, false, ""},
		ltTestCase{float64(kTwoTo25 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) Float64AboveExactIntegerRange() {
	// Double-precision floats don't have enough bits to represent the integers
	// near this one distinctly, so [2^54-1, 2^54+2] all receive the same value
	// and should be treated as equivalent when floats are in the mix.
	const kTwoTo54 = 1 << 54
	matcher := LessThan(float64(kTwoTo54 + 1))

	desc := matcher.Description()
	expectedDesc := "less than 1.8014398509481984e+16"

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		// Signed integers.
		ltTestCase{int64(-1), true, false, ""},
		ltTestCase{int64(kTwoTo54 - 2), true, false, ""},
		ltTestCase{int64(kTwoTo54 - 1), false, false, ""},
		ltTestCase{int64(kTwoTo54 + 0), false, false, ""},
		ltTestCase{int64(kTwoTo54 + 1), false, false, ""},
		ltTestCase{int64(kTwoTo54 + 2), false, false, ""},
		ltTestCase{int64(kTwoTo54 + 3), false, false, ""},

		// Unsigned integers.
		ltTestCase{uint64(0), true, false, ""},
		ltTestCase{uint64(kTwoTo54 - 2), true, false, ""},
		ltTestCase{uint64(kTwoTo54 - 1), false, false, ""},
		ltTestCase{uint64(kTwoTo54 + 0), false, false, ""},
		ltTestCase{uint64(kTwoTo54 + 1), false, false, ""},
		ltTestCase{uint64(kTwoTo54 + 2), false, false, ""},
		ltTestCase{uint64(kTwoTo54 + 3), false, false, ""},

		// Floating point.
		ltTestCase{float64(-1), true, false, ""},
		ltTestCase{float64(kTwoTo54 - 2), true, false, ""},
		ltTestCase{float64(kTwoTo54 - 1), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 0), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 1), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 2), false, false, ""},
		ltTestCase{float64(kTwoTo54 + 3), false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

////////////////////////////////////////////////////////////////////////
// String literals
////////////////////////////////////////////////////////////////////////

func (t *LessThanTest) EmptyString() {
	matcher := LessThan("")
	desc := matcher.Description()
	expectedDesc := "less than \"\""

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		ltTestCase{"", false, false, ""},
		ltTestCase{"\x00", false, false, ""},
		ltTestCase{"a", false, false, ""},
		ltTestCase{"foo", false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) SingleNullByte() {
	matcher := LessThan("\x00")
	desc := matcher.Description()
	expectedDesc := "less than \"\x00\""

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		ltTestCase{"", true, false, ""},
		ltTestCase{"\x00", false, false, ""},
		ltTestCase{"a", false, false, ""},
		ltTestCase{"foo", false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}

func (t *LessThanTest) LongerString() {
	matcher := LessThan("foo\x00")
	desc := matcher.Description()
	expectedDesc := "less than \"foo\x00\""

	ExpectThat(desc, Equals(expectedDesc))

	cases := []ltTestCase{
		ltTestCase{"", true, false, ""},
		ltTestCase{"\x00", true, false, ""},
		ltTestCase{"bar", true, false, ""},
		ltTestCase{"foo", true, false, ""},
		ltTestCase{"foo\x00", false, false, ""},
		ltTestCase{"fooa", false, false, ""},
		ltTestCase{"qux", false, false, ""},
	}

	t.checkTestCases(matcher, cases)
}
