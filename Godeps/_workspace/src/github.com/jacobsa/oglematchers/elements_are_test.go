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
	. "github.com/jacobsa/oglematchers"
	. "github.com/jacobsa/ogletest"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type ElementsAreTest struct {
}

func init()                     { RegisterTestSuite(&ElementsAreTest{}) }

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *ElementsAreTest) EmptySet() {
	m := ElementsAre()
	ExpectEq("elements are: []", m.Description())

	var c []interface{}
	var err error

	// No candidates.
	c = []interface{}{}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// One candidate.
	c = []interface{}{17}
	err = m.Matches(c)
	ExpectThat(err, Error(HasSubstr("length 1")))
}

func (t *ElementsAreTest) OneMatcher() {
	m := ElementsAre(LessThan(17))
	ExpectEq("elements are: [less than 17]", m.Description())

	var c []interface{}
	var err error

	// No candidates.
	c = []interface{}{}
	err = m.Matches(c)
	ExpectThat(err, Error(HasSubstr("length 0")))

	// Matching candidate.
	c = []interface{}{16}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Non-matching candidate.
	c = []interface{}{19}
	err = m.Matches(c)
	ExpectNe(nil, err)

	// Two candidates.
	c = []interface{}{17, 19}
	err = m.Matches(c)
	ExpectThat(err, Error(HasSubstr("length 2")))
}

func (t *ElementsAreTest) OneValue() {
	m := ElementsAre(17)
	ExpectEq("elements are: [17]", m.Description())

	var c []interface{}
	var err error

	// No candidates.
	c = []interface{}{}
	err = m.Matches(c)
	ExpectThat(err, Error(HasSubstr("length 0")))

	// Matching int.
	c = []interface{}{int(17)}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Matching float.
	c = []interface{}{float32(17)}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Non-matching candidate.
	c = []interface{}{19}
	err = m.Matches(c)
	ExpectNe(nil, err)

	// Two candidates.
	c = []interface{}{17, 19}
	err = m.Matches(c)
	ExpectThat(err, Error(HasSubstr("length 2")))
}

func (t *ElementsAreTest) MultipleElements() {
	m := ElementsAre("taco", LessThan(17))
	ExpectEq("elements are: [taco, less than 17]", m.Description())

	var c []interface{}
	var err error

	// One candidate.
	c = []interface{}{17}
	err = m.Matches(c)
	ExpectThat(err, Error(HasSubstr("length 1")))

	// Both matching.
	c = []interface{}{"taco", 16}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// First non-matching.
	c = []interface{}{"burrito", 16}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("whose element 0 doesn't match")))

	// Second non-matching.
	c = []interface{}{"taco", 17}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("whose element 1 doesn't match")))

	// Three candidates.
	c = []interface{}{"taco", 17, 19}
	err = m.Matches(c)
	ExpectThat(err, Error(HasSubstr("length 3")))
}

func (t *ElementsAreTest) ArrayCandidates() {
	m := ElementsAre("taco", LessThan(17))

	var err error

	// One candidate.
	err = m.Matches([1]interface{}{"taco"})
	ExpectThat(err, Error(HasSubstr("length 1")))

	// Both matching.
	err = m.Matches([2]interface{}{"taco", 16})
	ExpectEq(nil, err)

	// First non-matching.
	err = m.Matches([2]interface{}{"burrito", 16})
	ExpectThat(err, Error(Equals("whose element 0 doesn't match")))
}

func (t *ElementsAreTest) WrongTypeCandidate() {
	m := ElementsAre("taco")

	var err error

	// String candidate.
	err = m.Matches("taco")
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("array")))
	ExpectThat(err, Error(HasSubstr("slice")))

	// Map candidate.
	err = m.Matches(map[string]string{})
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("array")))
	ExpectThat(err, Error(HasSubstr("slice")))

	// Nil candidate.
	err = m.Matches(nil)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("array")))
	ExpectThat(err, Error(HasSubstr("slice")))
}

func (t *ElementsAreTest) PropagatesFatality() {
	m := ElementsAre(LessThan(17))
	ExpectEq("elements are: [less than 17]", m.Description())

	var c []interface{}
	var err error

	// Non-fatal error.
	c = []interface{}{19}
	err = m.Matches(c)
	AssertNe(nil, err)
	ExpectFalse(isFatal(err))

	// Fatal error.
	c = []interface{}{"taco"}
	err = m.Matches(c)
	AssertNe(nil, err)
	ExpectTrue(isFatal(err))
}
