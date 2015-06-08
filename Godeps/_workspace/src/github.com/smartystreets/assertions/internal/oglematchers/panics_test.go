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

type PanicsTest struct {
	matcherCalled bool
	suppliedCandidate interface{}
	wrappedError error

	matcher Matcher
}

func init() { RegisterTestSuite(&PanicsTest{}) }

func (t *PanicsTest) SetUp(i *TestInfo) {
	wrapped := &fakeMatcher{
		func(c interface{}) error {
			t.matcherCalled = true
			t.suppliedCandidate = c
			return t.wrappedError
		},
		"foo",
	}

	t.matcher = Panics(wrapped)
}

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *PanicsTest) Description() {
	ExpectThat(t.matcher.Description(), Equals("panics with: foo"))
}

func (t *PanicsTest) CandidateIsNil() {
	err := t.matcher.Matches(nil)

	ExpectThat(err, Error(Equals("which is not a zero-arg function")))
	ExpectTrue(isFatal(err))
}

func (t *PanicsTest) CandidateIsString() {
	err := t.matcher.Matches("taco")

	ExpectThat(err, Error(Equals("which is not a zero-arg function")))
	ExpectTrue(isFatal(err))
}

func (t *PanicsTest) CandidateTakesArgs() {
	err := t.matcher.Matches(func(i int) string { return "" })

	ExpectThat(err, Error(Equals("which is not a zero-arg function")))
	ExpectTrue(isFatal(err))
}

func (t *PanicsTest) CallsFunction() {
	callCount := 0
	t.matcher.Matches(func() string {
		callCount++
		return ""
	})

	ExpectThat(callCount, Equals(1))
}

func (t *PanicsTest) FunctionDoesntPanic() {
	err := t.matcher.Matches(func() {})

	ExpectThat(err, Error(Equals("which didn't panic")))
	ExpectFalse(isFatal(err))
}

func (t *PanicsTest) CallsWrappedMatcher() {
	expectedErr := 17
	t.wrappedError = errors.New("")
	t.matcher.Matches(func() { panic(expectedErr) })

	ExpectThat(t.suppliedCandidate, Equals(expectedErr))
}

func (t *PanicsTest) WrappedReturnsTrue() {
	err := t.matcher.Matches(func() { panic("") })

	ExpectEq(nil, err)
}

func (t *PanicsTest) WrappedReturnsFatalErrorWithoutText() {
	t.wrappedError = NewFatalError("")
	err := t.matcher.Matches(func() { panic(17) })

	ExpectThat(err, Error(Equals("which panicked with: 17")))
	ExpectFalse(isFatal(err))
}

func (t *PanicsTest) WrappedReturnsFatalErrorWithText() {
	t.wrappedError = NewFatalError("which blah")
	err := t.matcher.Matches(func() { panic(17) })

	ExpectThat(err, Error(Equals("which panicked with: 17, which blah")))
	ExpectFalse(isFatal(err))
}

func (t *PanicsTest) WrappedReturnsNonFatalErrorWithoutText() {
	t.wrappedError = errors.New("")
	err := t.matcher.Matches(func() { panic(17) })

	ExpectThat(err, Error(Equals("which panicked with: 17")))
	ExpectFalse(isFatal(err))
}

func (t *PanicsTest) WrappedReturnsNonFatalErrorWithText() {
	t.wrappedError = errors.New("which blah")
	err := t.matcher.Matches(func() { panic(17) })

	ExpectThat(err, Error(Equals("which panicked with: 17, which blah")))
	ExpectFalse(isFatal(err))
}
