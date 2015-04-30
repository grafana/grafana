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

// Package oglematchers provides a set of matchers useful in a testing or
// mocking framework. These matchers are inspired by and mostly compatible with
// Google Test for C++ and Google JS Test.
//
// This package is used by github.com/smartystreets/assertions/internal/ogletest and
// github.com/smartystreets/assertions/internal/oglemock, which may be more directly useful if you're not
// writing your own testing package or defining your own matchers.
package oglematchers

// A Matcher is some predicate implicitly defining a set of values that it
// matches. For example, GreaterThan(17) matches all numeric values greater
// than 17, and HasSubstr("taco") matches all strings with the substring
// "taco".
type Matcher interface {
	// Check whether the supplied value belongs to the the set defined by the
	// matcher. Return a non-nil error if and only if it does not.
	//
	// The error describes why the value doesn't match. The error text is a
	// relative clause that is suitable for being placed after the value. For
	// example, a predicate that matches strings with a particular substring may,
	// when presented with a numerical value, return the following error text:
	//
	//     "which is not a string"
	//
	// Then the failure message may look like:
	//
	//     Expected: has substring "taco"
	//     Actual:   17, which is not a string
	//
	// If the error is self-apparent based on the description of the matcher, the
	// error text may be empty (but the error still non-nil). For example:
	//
	//     Expected: 17
	//     Actual:   19
	//
	// If you are implementing a new matcher, see also the documentation on
	// FatalError.
	Matches(candidate interface{}) error

	// Description returns a string describing the property that values matching
	// this matcher have, as a verb phrase where the subject is the value. For
	// example, "is greather than 17" or "has substring "taco"".
	Description() string
}

// FatalError is an implementation of the error interface that may be returned
// from matchers, indicating the error should be propagated. Returning a
// *FatalError indicates that the matcher doesn't process values of the
// supplied type, or otherwise doesn't know how to handle the value.
//
// For example, if GreaterThan(17) returned false for the value "taco" without
// a fatal error, then Not(GreaterThan(17)) would return true. This is
// technically correct, but is surprising and may mask failures where the wrong
// sort of matcher is accidentally used. Instead, GreaterThan(17) can return a
// fatal error, which will be propagated by Not().
type FatalError struct {
	errorText string
}

// NewFatalError creates a FatalError struct with the supplied error text.
func NewFatalError(s string) *FatalError {
	return &FatalError{s}
}

func (e *FatalError) Error() string {
	return e.errorText
}
