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
	"testing"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type fakeMatcher struct {
	matchFunc   func(interface{}) error
	description string
}

func (m *fakeMatcher) Matches(c interface{}) error {
	return m.matchFunc(c)
}

func (m *fakeMatcher) Description() string {
	return m.description
}

type NotTest struct {

}

func init()                     { RegisterTestSuite(&NotTest{}) }
func TestOgletest(t *testing.T) { RunTests(t) }

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *NotTest) CallsWrapped() {
	var suppliedCandidate interface{}
	matchFunc := func(c interface{}) error {
		suppliedCandidate = c
		return nil
	}

	wrapped := &fakeMatcher{matchFunc, ""}
	matcher := Not(wrapped)

	matcher.Matches(17)
	ExpectThat(suppliedCandidate, Equals(17))
}

func (t *NotTest) WrappedReturnsTrue() {
	matchFunc := func(c interface{}) error {
		return nil
	}

	wrapped := &fakeMatcher{matchFunc, ""}
	matcher := Not(wrapped)

	err := matcher.Matches(0)
	ExpectThat(err, Error(Equals("")))
}

func (t *NotTest) WrappedReturnsNonFatalError() {
	matchFunc := func(c interface{}) error {
		return errors.New("taco")
	}

	wrapped := &fakeMatcher{matchFunc, ""}
	matcher := Not(wrapped)

	err := matcher.Matches(0)
	ExpectEq(nil, err)
}

func (t *NotTest) WrappedReturnsFatalError() {
	matchFunc := func(c interface{}) error {
		return NewFatalError("taco")
	}

	wrapped := &fakeMatcher{matchFunc, ""}
	matcher := Not(wrapped)

	err := matcher.Matches(0)
	ExpectThat(err, Error(Equals("taco")))
}

func (t *NotTest) Description() {
	wrapped := &fakeMatcher{nil, "taco"}
	matcher := Not(wrapped)

	ExpectEq("not(taco)", matcher.Description())
}
