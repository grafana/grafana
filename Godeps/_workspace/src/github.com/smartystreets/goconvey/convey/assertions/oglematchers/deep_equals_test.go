// Copyright 2012 Aaron Jacobs. All Rights Reserved.
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
	"bytes"
	"testing"
	. "github.com/smartystreets/goconvey/convey/assertions/oglematchers"
	. "github.com/smartystreets/goconvey/convey/assertions/ogletest"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type DeepEqualsTest struct{}

func init() { RegisterTestSuite(&DeepEqualsTest{}) }

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *DeepEqualsTest) WrongTypeCandidateWithScalarValue() {
	var x int = 17
	m := DeepEquals(x)

	var err error

	// Nil candidate.
	err = m.Matches(nil)
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("<nil>")))

	// Int alias candidate.
	type intAlias int
	err = m.Matches(intAlias(x))
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("intAlias")))

	// String candidate.
	err = m.Matches("taco")
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("string")))

	// Byte slice candidate.
	err = m.Matches([]byte{})
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("[]uint8")))

	// Other slice candidate.
	err = m.Matches([]uint16{})
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("[]uint16")))

	// Unsigned int candidate.
	err = m.Matches(uint(17))
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("uint")))
}

func (t *DeepEqualsTest) WrongTypeCandidateWithByteSliceValue() {
	x := []byte{}
	m := DeepEquals(x)

	var err error

	// Nil candidate.
	err = m.Matches(nil)
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("<nil>")))

	// String candidate.
	err = m.Matches("taco")
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("string")))

	// Slice candidate with wrong value type.
	err = m.Matches([]uint16{})
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("[]uint16")))
}

func (t *DeepEqualsTest) WrongTypeCandidateWithOtherSliceValue() {
	x := []uint16{}
	m := DeepEquals(x)

	var err error

	// Nil candidate.
	err = m.Matches(nil)
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("<nil>")))

	// String candidate.
	err = m.Matches("taco")
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("string")))

	// Byte slice candidate with wrong value type.
	err = m.Matches([]byte{})
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("[]uint8")))

	// Other slice candidate with wrong value type.
	err = m.Matches([]uint32{})
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("[]uint32")))
}

func (t *DeepEqualsTest) WrongTypeCandidateWithNilLiteralValue() {
	m := DeepEquals(nil)

	var err error

	// String candidate.
	err = m.Matches("taco")
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("string")))

	// Nil byte slice candidate.
	err = m.Matches([]byte(nil))
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("[]uint8")))

	// Nil other slice candidate.
	err = m.Matches([]uint16(nil))
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("type")))
	ExpectThat(err, Error(HasSubstr("[]uint16")))
}

func (t *DeepEqualsTest) NilLiteralValue() {
	m := DeepEquals(nil)
	ExpectEq("deep equals: <nil>", m.Description())

	var c interface{}
	var err error

	// Nil literal candidate.
	c = nil
	err = m.Matches(c)
	ExpectEq(nil, err)
}

func (t *DeepEqualsTest) IntValue() {
	m := DeepEquals(int(17))
	ExpectEq("deep equals: 17", m.Description())

	var c interface{}
	var err error

	// Matching int.
	c = int(17)
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Non-matching int.
	c = int(18)
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))
}

func (t *DeepEqualsTest) ByteSliceValue() {
	x := []byte{17, 19}
	m := DeepEquals(x)
	ExpectEq("deep equals: [17 19]", m.Description())

	var c []byte
	var err error

	// Matching.
	c = make([]byte, len(x))
	AssertEq(len(x), copy(c, x))

	err = m.Matches(c)
	ExpectEq(nil, err)

	// Nil slice.
	c = []byte(nil)
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("which is nil")))

	// Prefix.
	AssertGt(len(x), 1)
	c = make([]byte, len(x)-1)
	AssertEq(len(x)-1, copy(c, x))

	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Suffix.
	c = make([]byte, len(x)+1)
	AssertEq(len(x), copy(c, x))

	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))
}

func (t *DeepEqualsTest) OtherSliceValue() {
	x := []uint16{17, 19}
	m := DeepEquals(x)
	ExpectEq("deep equals: [17 19]", m.Description())

	var c []uint16
	var err error

	// Matching.
	c = make([]uint16, len(x))
	AssertEq(len(x), copy(c, x))

	err = m.Matches(c)
	ExpectEq(nil, err)

	// Nil slice.
	c = []uint16(nil)
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("which is nil")))

	// Prefix.
	AssertGt(len(x), 1)
	c = make([]uint16, len(x)-1)
	AssertEq(len(x)-1, copy(c, x))

	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Suffix.
	c = make([]uint16, len(x)+1)
	AssertEq(len(x), copy(c, x))

	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))
}

func (t *DeepEqualsTest) NilByteSliceValue() {
	x := []byte(nil)
	m := DeepEquals(x)
	ExpectEq("deep equals: <nil slice>", m.Description())

	var c []byte
	var err error

	// Nil slice.
	c = []byte(nil)
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Non-nil slice.
	c = []byte{}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))
}

func (t *DeepEqualsTest) NilOtherSliceValue() {
	x := []uint16(nil)
	m := DeepEquals(x)
	ExpectEq("deep equals: <nil slice>", m.Description())

	var c []uint16
	var err error

	// Nil slice.
	c = []uint16(nil)
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Non-nil slice.
	c = []uint16{}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))
}

////////////////////////////////////////////////////////////////////////
// Benchmarks
////////////////////////////////////////////////////////////////////////

func benchmarkWithSize(b *testing.B, size int) {
	b.StopTimer()
	buf := bytes.Repeat([]byte{0x01}, size)
	bufCopy := make([]byte, size)
	copy(bufCopy, buf)

	matcher := DeepEquals(buf)
	b.StartTimer()

	for i := 0; i < b.N; i++ {
		matcher.Matches(bufCopy)
	}

	b.SetBytes(int64(size))
}

func BenchmarkShortByteSlice(b *testing.B) {
	benchmarkWithSize(b, 256)
}

func BenchmarkLongByteSlice(b *testing.B) {
	benchmarkWithSize(b, 1<<24)
}
