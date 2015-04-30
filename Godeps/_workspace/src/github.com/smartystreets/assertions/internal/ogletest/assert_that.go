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
	"github.com/smartystreets/assertions/internal/oglematchers"
)

// AssertThat is identical to ExpectThat, except that in the event of failure
// it halts the currently running test immediately. It is thus useful for
// things like bounds checking:
//
//     someSlice := [...]
//     AssertEq(1, len(someSlice))  // Protects next line from panicking.
//     ExpectEq("taco", someSlice[0])
//
func AssertThat(
	x interface{},
	m oglematchers.Matcher,
	errorParts ...interface{}) ExpectationResult {
	res := ExpectThat(x, m, errorParts...)
	res.SetCaller(getCallerForAlias())

	matcherErr := res.MatchResult()
	if matcherErr != nil {
		panic(&assertThatError{})
	}

	return res
}

// assertThatError is a sentinel type that is used in a conspiracy between
// AssertThat and runTests. If runTests sees a *assertThatError as the value
// given to a panic() call, it will avoid printing the panic error.
type assertThatError struct {
}
