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
	. "github.com/jacobsa/oglematchers"
	. "github.com/jacobsa/ogletest"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type ErrorTest struct {
	matcherCalled bool
	suppliedCandidate interface{}
	wrappedError error

	matcher Matcher
}

func init() { RegisterTestSuite(&ErrorTest{}) }

func (t *ErrorTest) SetUp(i *TestInfo) {
	wrapped := &fakeMatcher{
		func(c interface{}) error {
			t.matcherCalled = true
			t.suppliedCandidate = c
			return t.wrappedError
		},
		"is foo",
	}

	t.matcher = Error(wrapped)
}

func isFatal(err error) bool {
	_, isFatal := err.(*FatalError)
	return isFatal
}

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *ErrorTest) Description() {
	ExpectThat(t.matcher.Description(), Equals("error is foo"))
}

func (t *ErrorTest) CandidateIsNil() {
	err := t.matcher.Matches(nil)

	ExpectThat(t.matcherCalled, Equals(false))
	ExpectThat(err.Error(), Equals("which is not an error"))
	ExpectTrue(isFatal(err))
}

func (t *ErrorTest) CandidateIsString() {
	err := t.matcher.Matches("taco")

	ExpectThat(t.matcherCalled, Equals(false))
	ExpectThat(err.Error(), Equals("which is not an error"))
	ExpectTrue(isFatal(err))
}

func (t *ErrorTest) CallsWrappedMatcher() {
	candidate := errors.New("taco")
	t.matcher.Matches(candidate)

	ExpectThat(t.matcherCalled, Equals(true))
	ExpectThat(t.suppliedCandidate, Equals("taco"))
}

func (t *ErrorTest) ReturnsWrappedMatcherResult() {
	t.wrappedError = errors.New("burrito")
	err := t.matcher.Matches(errors.New(""))
	ExpectThat(err, Equals(t.wrappedError))
}
