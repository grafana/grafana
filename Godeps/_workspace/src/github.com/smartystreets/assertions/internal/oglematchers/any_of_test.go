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
	"errors"

	. "github.com/smartystreets/assertions/internal/oglematchers"
	. "github.com/smartystreets/assertions/internal/ogletest"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type fakeAnyOfMatcher struct {
	desc string
	err  error
}

func (m *fakeAnyOfMatcher) Matches(c interface{}) error {
	return m.err
}

func (m *fakeAnyOfMatcher) Description() string {
	return m.desc
}

type AnyOfTest struct {
}

func init() { RegisterTestSuite(&AnyOfTest{}) }

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *AnyOfTest) EmptySet() {
	matcher := AnyOf()

	err := matcher.Matches(0)
	ExpectThat(err, Error(Equals("")))
}

func (t *AnyOfTest) OneTrue() {
	matcher := AnyOf(
		&fakeAnyOfMatcher{"", NewFatalError("foo")},
		17,
		&fakeAnyOfMatcher{"", errors.New("foo")},
		&fakeAnyOfMatcher{"", nil},
		&fakeAnyOfMatcher{"", errors.New("foo")},
	)

	err := matcher.Matches(0)
	ExpectEq(nil, err)
}

func (t *AnyOfTest) OneEqual() {
	matcher := AnyOf(
		&fakeAnyOfMatcher{"", NewFatalError("foo")},
		&fakeAnyOfMatcher{"", errors.New("foo")},
		13,
		"taco",
		19,
		&fakeAnyOfMatcher{"", errors.New("foo")},
	)

	err := matcher.Matches("taco")
	ExpectEq(nil, err)
}

func (t *AnyOfTest) OneFatal() {
	matcher := AnyOf(
		&fakeAnyOfMatcher{"", errors.New("foo")},
		17,
		&fakeAnyOfMatcher{"", NewFatalError("taco")},
		&fakeAnyOfMatcher{"", errors.New("foo")},
	)

	err := matcher.Matches(0)
	ExpectThat(err, Error(Equals("taco")))
}

func (t *AnyOfTest) OneNil() {
	var err error
	matcher := AnyOf(
		13,
		nil,
		19,
	)

	// No match
	err = matcher.Matches(14)
	ExpectNe(nil, err)

	// Match
	err = matcher.Matches(nil)
	ExpectEq(nil, err)
}

func (t *AnyOfTest) AllFalseAndNotEqual() {
	matcher := AnyOf(
		&fakeAnyOfMatcher{"", errors.New("foo")},
		17,
		&fakeAnyOfMatcher{"", errors.New("foo")},
		19,
	)

	err := matcher.Matches(0)
	ExpectThat(err, Error(Equals("")))
}

func (t *AnyOfTest) DescriptionForEmptySet() {
	matcher := AnyOf()
	ExpectEq("or()", matcher.Description())
}

func (t *AnyOfTest) DescriptionForNonEmptySet() {
	matcher := AnyOf(
		&fakeAnyOfMatcher{"taco", nil},
		"burrito",
		&fakeAnyOfMatcher{"enchilada", nil},
	)

	ExpectEq("or(taco, burrito, enchilada)", matcher.Description())
}
