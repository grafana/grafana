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
	"errors"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type allOfFakeMatcher struct {
	desc string
	err  error
}

func (m *allOfFakeMatcher) Matches(c interface{}) error {
	return m.err
}

func (m *allOfFakeMatcher) Description() string {
	return m.desc
}

type AllOfTest struct {
}

func init() { RegisterTestSuite(&AllOfTest{}) }

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *AllOfTest) DescriptionWithEmptySet() {
	m := AllOf()
	ExpectEq("is anything", m.Description())
}

func (t *AllOfTest) DescriptionWithOneMatcher() {
	m := AllOf(&allOfFakeMatcher{"taco", errors.New("")})
	ExpectEq("taco", m.Description())
}

func (t *AllOfTest) DescriptionWithMultipleMatchers() {
	m := AllOf(
		&allOfFakeMatcher{"taco", errors.New("")},
		&allOfFakeMatcher{"burrito", errors.New("")},
		&allOfFakeMatcher{"enchilada", errors.New("")})

	ExpectEq("taco, and burrito, and enchilada", m.Description())
}

func (t *AllOfTest) EmptySet() {
	m := AllOf()
	err := m.Matches(17)

	ExpectEq(nil, err)
}

func (t *AllOfTest) OneMatcherReturnsFatalErrorAndSomeOthersFail() {
	m := AllOf(
		&allOfFakeMatcher{"", errors.New("")},
		&allOfFakeMatcher{"", NewFatalError("taco")},
		&allOfFakeMatcher{"", errors.New("")},
		&allOfFakeMatcher{"", nil})

	err := m.Matches(17)

	ExpectTrue(isFatal(err))
	ExpectThat(err, Error(Equals("taco")))
}

func (t *AllOfTest) OneMatcherReturnsNonFatalAndOthersSayTrue() {
	m := AllOf(
		&allOfFakeMatcher{"", nil},
		&allOfFakeMatcher{"", errors.New("taco")},
		&allOfFakeMatcher{"", nil})

	err := m.Matches(17)

	ExpectFalse(isFatal(err))
	ExpectThat(err, Error(Equals("taco")))
}

func (t *AllOfTest) AllMatchersSayTrue() {
	m := AllOf(
		&allOfFakeMatcher{"", nil},
		&allOfFakeMatcher{"", nil},
		&allOfFakeMatcher{"", nil})

	err := m.Matches(17)

	ExpectEq(nil, err)
}
