// Copyright 2015 Aaron Jacobs. All Rights Reserved.
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
	"io"
	"testing"

	. "github.com/smartystreets/assertions/internal/oglematchers"
	. "github.com/smartystreets/assertions/internal/ogletest"
)

func TestHasSameTypeAs(t *testing.T) { RunTests(t) }

////////////////////////////////////////////////////////////////////////
// Boilerplate
////////////////////////////////////////////////////////////////////////

type HasSameTypeAsTest struct {
}

func init() { RegisterTestSuite(&HasSameTypeAsTest{}) }

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *HasSameTypeAsTest) CandidateIsLiteralNil() {
	matcher := HasSameTypeAs(nil)
	var err error

	// Description
	ExpectEq("has type <nil>", matcher.Description())

	// Literal nil
	err = matcher.Matches(nil)
	ExpectEq(nil, err)

	// nil in interface variable
	var r io.Reader
	err = matcher.Matches(r)
	ExpectEq(nil, err)

	// int
	err = matcher.Matches(17)
	AssertNe(nil, err)
	ExpectThat(err, Error(Equals("which has type int")))

	// string
	err = matcher.Matches("")
	AssertNe(nil, err)
	ExpectThat(err, Error(Equals("which has type string")))

	// nil map
	var m map[string]string
	err = matcher.Matches(m)

	AssertNe(nil, err)
	ExpectThat(err, Error(Equals("which has type map[string]string")))

	// Non-nil map
	m = make(map[string]string)
	err = matcher.Matches(m)

	AssertNe(nil, err)
	ExpectThat(err, Error(Equals("which has type map[string]string")))
}

func (t *HasSameTypeAsTest) CandidateIsNilMap() {
	var m map[string]string
	matcher := HasSameTypeAs(m)
	var err error

	// Description
	ExpectEq("has type map[string]string", matcher.Description())

	// nil map
	m = nil
	err = matcher.Matches(m)
	ExpectEq(nil, err)

	// Non-nil map
	m = make(map[string]string)
	err = matcher.Matches(m)
	ExpectEq(nil, err)

	// Literal nil
	err = matcher.Matches(nil)
	AssertNe(nil, err)
	ExpectThat(err, Error(Equals("which has type <nil>")))

	// int
	err = matcher.Matches(17)
	AssertNe(nil, err)
	ExpectThat(err, Error(Equals("which has type int")))

	// string
	err = matcher.Matches("")
	AssertNe(nil, err)
	ExpectThat(err, Error(Equals("which has type string")))
}

func (t *HasSameTypeAsTest) CandidateIsNilInInterfaceVariable() {
	var r io.Reader
	matcher := HasSameTypeAs(r)
	var err error

	// Description
	ExpectEq("has type <nil>", matcher.Description())

	// nil in interface variable
	r = nil
	err = matcher.Matches(r)
	ExpectEq(nil, err)

	// Literal nil
	err = matcher.Matches(nil)
	ExpectEq(nil, err)

	// int
	err = matcher.Matches(17)
	AssertNe(nil, err)
	ExpectThat(err, Error(Equals("which has type int")))
}

func (t *HasSameTypeAsTest) CandidateIsString() {
	matcher := HasSameTypeAs("")
	var err error

	// Description
	ExpectEq("has type string", matcher.Description())

	// string
	err = matcher.Matches("taco")
	ExpectEq(nil, err)

	// string alias
	type Foo string
	err = matcher.Matches(Foo("taco"))
	ExpectThat(err, Error(MatchesRegexp("which has type .*Foo")))

	// Literal nil
	err = matcher.Matches(nil)
	AssertNe(nil, err)
	ExpectThat(err, Error(Equals("which has type <nil>")))

	// int
	err = matcher.Matches(17)
	AssertNe(nil, err)
	ExpectThat(err, Error(Equals("which has type int")))
}

func (t *HasSameTypeAsTest) CandidateIsStringAlias() {
	type Foo string
	matcher := HasSameTypeAs(Foo(""))
	var err error

	// Description
	ExpectThat(matcher.Description(), MatchesRegexp("has type .*Foo"))

	// string alias
	err = matcher.Matches(Foo("taco"))
	ExpectEq(nil, err)

	// string
	err = matcher.Matches("taco")
	ExpectThat(err, Error(Equals("which has type string")))
}
