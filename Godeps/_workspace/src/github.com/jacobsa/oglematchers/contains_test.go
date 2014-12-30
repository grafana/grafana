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

type ContainsTest struct {}
func init() { RegisterTestSuite(&ContainsTest{}) }

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *ContainsTest) WrongTypeCandidates() {
	m := Contains("")
	ExpectEq("contains: ", m.Description())

	var err error

	// Nil candidate
	err = m.Matches(nil)
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("array")))
	ExpectThat(err, Error(HasSubstr("slice")))

	// String candidate
	err = m.Matches("")
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("array")))
	ExpectThat(err, Error(HasSubstr("slice")))

	// Map candidate
	err = m.Matches(make(map[string]string))
	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(HasSubstr("array")))
	ExpectThat(err, Error(HasSubstr("slice")))
}

func (t *ContainsTest) NilArgument() {
	m := Contains(nil)
	ExpectEq("contains: is nil", m.Description())

	var c interface{}
	var err error

	// Empty array of pointers
	c = [...]*int{}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Empty slice of pointers
	c = []*int{}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Non-empty array of integers
	c = [...]int{17, 0, 19}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Non-empty slice of integers
	c = []int{17, 0, 19}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Non-matching array of pointers
	c = [...]*int{new(int), new(int)}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Non-matching slice of pointers
	c = []*int{new(int), new(int)}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Matching array of pointers
	c = [...]*int{new(int), nil, new(int)}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Matching slice of pointers
	c = []*int{new(int), nil, new(int)}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Non-matching slice of pointers from matching array
	someArray := [...]*int{new(int), nil, new(int)}
	c = someArray[0:1]
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))
}

func (t *ContainsTest) StringArgument() {
	m := Contains("taco")
	ExpectEq("contains: taco", m.Description())

	var c interface{}
	var err error

	// Non-matching array of strings
	c = [...]string{"burrito", "enchilada"}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Non-matching slice of strings
	c = []string{"burrito", "enchilada"}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Matching array of strings
	c = [...]string{"burrito", "taco", "enchilada"}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Matching slice of strings
	c = []string{"burrito", "taco", "enchilada"}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Non-matching slice of strings from matching array
	someArray := [...]string{"burrito", "taco", "enchilada"}
	c = someArray[0:1]
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))
}

func (t *ContainsTest) IntegerArgument() {
	m := Contains(int(17))
	ExpectEq("contains: 17", m.Description())

	var c interface{}
	var err error

	// Non-matching array of integers
	c = [...]int{13, 19}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Non-matching slice of integers
	c = []int{13, 19}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Matching array of integers
	c = [...]int{13, 17, 19}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Matching slice of integers
	c = []int{13, 17, 19}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Non-matching slice of integers from matching array
	someArray := [...]int{13, 17, 19}
	c = someArray[0:1]
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Non-matching array of floats
	c = [...]float32{13, 17.5, 19}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Non-matching slice of floats
	c = []float32{13, 17.5, 19}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Matching array of floats
	c = [...]float32{13, 17, 19}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Matching slice of floats
	c = []float32{13, 17, 19}
	err = m.Matches(c)
	ExpectEq(nil, err)
}

func (t *ContainsTest) MatcherArgument() {
	m := Contains(HasSubstr("ac"))
	ExpectEq("contains: has substring \"ac\"", m.Description())

	var c interface{}
	var err error

	// Non-matching array of strings
	c = [...]string{"burrito", "enchilada"}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Non-matching slice of strings
	c = []string{"burrito", "enchilada"}
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))

	// Matching array of strings
	c = [...]string{"burrito", "taco", "enchilada"}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Matching slice of strings
	c = []string{"burrito", "taco", "enchilada"}
	err = m.Matches(c)
	ExpectEq(nil, err)

	// Non-matching slice of strings from matching array
	someArray := [...]string{"burrito", "taco", "enchilada"}
	c = someArray[0:1]
	err = m.Matches(c)
	ExpectThat(err, Error(Equals("")))
}
