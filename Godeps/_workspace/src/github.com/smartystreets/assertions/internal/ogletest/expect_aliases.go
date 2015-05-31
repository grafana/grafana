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

import "github.com/smartystreets/assertions/internal/oglematchers"

// ExpectEq(e, a) is equivalent to ExpectThat(a, oglematchers.Equals(e)).
func ExpectEq(expected, actual interface{}, errorParts ...interface{}) {
	expectThat(actual, oglematchers.Equals(expected), 1, errorParts)
}

// ExpectNe(e, a) is equivalent to
// ExpectThat(a, oglematchers.Not(oglematchers.Equals(e))).
func ExpectNe(expected, actual interface{}, errorParts ...interface{}) {
	expectThat(
		actual,
		oglematchers.Not(oglematchers.Equals(expected)),
		1,
		errorParts)
}

// ExpectLt(x, y) is equivalent to ExpectThat(x, oglematchers.LessThan(y)).
func ExpectLt(x, y interface{}, errorParts ...interface{}) {
	expectThat(x, oglematchers.LessThan(y), 1, errorParts)
}

// ExpectLe(x, y) is equivalent to ExpectThat(x, oglematchers.LessOrEqual(y)).
func ExpectLe(x, y interface{}, errorParts ...interface{}) {
	expectThat(x, oglematchers.LessOrEqual(y), 1, errorParts)
}

// ExpectGt(x, y) is equivalent to ExpectThat(x, oglematchers.GreaterThan(y)).
func ExpectGt(x, y interface{}, errorParts ...interface{}) {
	expectThat(x, oglematchers.GreaterThan(y), 1, errorParts)
}

// ExpectGe(x, y) is equivalent to
// ExpectThat(x, oglematchers.GreaterOrEqual(y)).
func ExpectGe(x, y interface{}, errorParts ...interface{}) {
	expectThat(x, oglematchers.GreaterOrEqual(y), 1, errorParts)
}

// ExpectTrue(b) is equivalent to ExpectThat(b, oglematchers.Equals(true)).
func ExpectTrue(b interface{}, errorParts ...interface{}) {
	expectThat(b, oglematchers.Equals(true), 1, errorParts)
}

// ExpectFalse(b) is equivalent to ExpectThat(b, oglematchers.Equals(false)).
func ExpectFalse(b interface{}, errorParts ...interface{}) {
	expectThat(b, oglematchers.Equals(false), 1, errorParts)
}
