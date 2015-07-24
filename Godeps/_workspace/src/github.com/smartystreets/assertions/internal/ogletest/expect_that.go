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

package ogletest

import (
	"fmt"
	"path"
	"reflect"
	"runtime"

	"github.com/smartystreets/assertions/internal/oglematchers"
)

// ExpectThat confirms that the supplied matcher matches the value x, adding a
// failure record to the currently running test if it does not. If additional
// parameters are supplied, the first will be used as a format string for the
// later ones, and the user-supplied error message will be added to the test
// output in the event of a failure.
//
// For example:
//
//     ExpectThat(userName, Equals("jacobsa"))
//     ExpectThat(users[i], Equals("jacobsa"), "while processing user %d", i)
//
func ExpectThat(
	x interface{},
	m oglematchers.Matcher,
	errorParts ...interface{}) {
	expectThat(x, m, 1, errorParts)
}

// The generalized form of ExpectThat. depth is the distance on the stack
// between the caller's frame and the user's frame. Returns passed iff the
// match succeeded.
func expectThat(
	x interface{},
	m oglematchers.Matcher,
	depth int,
	errorParts []interface{}) (passed bool) {
	// Check whether the value matches. If it does, we are finished.
	matcherErr := m.Matches(x)
	if matcherErr == nil {
		passed = true
		return
	}

	var r FailureRecord

	// Get information about the call site.
	var ok bool
	if _, r.FileName, r.LineNumber, ok = runtime.Caller(depth + 1); !ok {
		panic("expectThat: runtime.Caller")
	}

	r.FileName = path.Base(r.FileName)

	// Create an appropriate failure message. Make sure that the expected and
	// actual values align properly.
	relativeClause := ""
	if matcherErr.Error() != "" {
		relativeClause = fmt.Sprintf(", %s", matcherErr.Error())
	}

	r.Error = fmt.Sprintf(
		"Expected: %s\nActual:   %v%s",
		m.Description(),
		x,
		relativeClause)

	// Add the user error, if any.
	if len(errorParts) != 0 {
		v := reflect.ValueOf(errorParts[0])
		if v.Kind() != reflect.String {
			panic(fmt.Sprintf("ExpectThat: invalid format string type %v", v.Kind()))
		}

		r.Error = fmt.Sprintf(
			"%s\n%s",
			r.Error,
			fmt.Sprintf(v.String(), errorParts[1:]...))
	}

	// Report the failure.
	AddFailureRecord(r)

	return
}
