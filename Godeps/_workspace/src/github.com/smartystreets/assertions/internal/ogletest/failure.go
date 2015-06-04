// Copyright 2015 Aaron Jacobs. All Rights Reserved.
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
	"runtime"
)

// FailureRecord represents a single failed expectation or assertion for a
// test. Most users don't want to interact with these directly; they are
// generated implicitly using ExpectThat, AssertThat, ExpectLt, etc.
type FailureRecord struct {
	// The file name within which the expectation failed, e.g. "foo_test.go".
	FileName string

	// The line number at which the expectation failed.
	LineNumber int

	// The error associated with the file:line pair above. For example, the
	// following expectation:
	//
	//     ExpectEq(17, "taco")"
	//
	// May cause this error:
	//
	//     Expected: 17
	//     Actual:   "taco", which is not numeric
	//
	Error string
}

// Record a failure for the currently running test (and continue running it).
// Most users will want to use ExpectThat, ExpectEq, etc. instead of this
// function. Those that do want to report arbitrary errors will probably be
// satisfied with AddFailure, which is easier to use.
func AddFailureRecord(r FailureRecord) {
	currentlyRunningTest.mu.Lock()
	defer currentlyRunningTest.mu.Unlock()

	currentlyRunningTest.failureRecords = append(
		currentlyRunningTest.failureRecords,
		r)
}

// Call AddFailureRecord with a record whose file name and line number come
// from the caller of this function, and whose error string is created by
// calling fmt.Sprintf using the arguments to this function.
func AddFailure(format string, a ...interface{}) {
	r := FailureRecord{
		Error: fmt.Sprintf(format, a...),
	}

	// Get information about the call site.
	var ok bool
	if _, r.FileName, r.LineNumber, ok = runtime.Caller(1); !ok {
		panic("Can't find caller")
	}

	r.FileName = path.Base(r.FileName)

	AddFailureRecord(r)
}

// A sentinel type that is used in a conspiracy between AbortTest and runTests.
// If runTests sees an abortError as the value given to a panic() call, it will
// avoid printing the panic error.
type abortError struct {
}

// Immediately stop executing the running test, causing it to fail with the
// failures previously recorded. Behavior is undefined if no failures have been
// recorded.
func AbortTest() {
	panic(abortError{})
}
