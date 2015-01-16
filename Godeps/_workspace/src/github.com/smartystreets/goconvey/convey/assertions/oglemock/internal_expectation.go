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

package oglemock

import (
	"errors"
	"fmt"
	"reflect"
	"sync"

	"github.com/smartystreets/goconvey/convey/assertions/oglematchers"
)

// InternalExpectation is exported for purposes of testing only. You should not
// touch it.
//
// InternalExpectation represents an expectation for zero or more calls to a
// mock method, and a set of actions to be taken when those calls are received.
type InternalExpectation struct {
	// The signature of the method to which this expectation is bound, for
	// checking action types.
	methodSignature reflect.Type

	// An error reporter to use for reporting errors in the way that expectations
	// are set.
	errorReporter ErrorReporter

	// A mutex protecting mutable fields of the struct.
	mutex sync.Mutex

	// Matchers that the arguments to the mock method must satisfy in order to
	// match this expectation.
	ArgMatchers []oglematchers.Matcher

	// The name of the file in which this expectation was expressed.
	FileName string

	// The line number at which this expectation was expressed.
	LineNumber int

	// The number of times this expectation should be matched, as explicitly
	// listed by the user. If there was no explicit number expressed, this is -1.
	ExpectedNumMatches int

	// Actions to be taken for the first N calls, one per call in order, where N
	// is the length of this slice.
	OneTimeActions []Action

	// An action to be taken when the one-time actions have expired, or nil if
	// there is no such action.
	FallbackAction Action

	// The number of times this expectation has been matched so far.
	NumMatches uint
}

// InternalNewExpectation is exported for purposes of testing only. You should
// not touch it.
func InternalNewExpectation(
	reporter ErrorReporter,
	methodSignature reflect.Type,
	args []interface{},
	fileName string,
	lineNumber int) *InternalExpectation {
	result := &InternalExpectation{}

	// Store fields that can be stored directly.
	result.methodSignature = methodSignature
	result.errorReporter = reporter
	result.FileName = fileName
	result.LineNumber = lineNumber

	// Set up defaults.
	result.ExpectedNumMatches = -1
	result.OneTimeActions = make([]Action, 0)

	// Set up the ArgMatchers slice, using Equals(x) for each x that is not a
	// matcher itself.
	result.ArgMatchers = make([]oglematchers.Matcher, len(args))
	for i, x := range args {
		if matcher, ok := x.(oglematchers.Matcher); ok {
			result.ArgMatchers[i] = matcher
		} else {
			result.ArgMatchers[i] = oglematchers.Equals(x)
		}
	}

	return result
}

func (e *InternalExpectation) Times(n uint) Expectation {
	e.mutex.Lock()
	defer e.mutex.Unlock()

	// It is illegal to call this more than once.
	if e.ExpectedNumMatches != -1 {
		e.reportFatalError("Times called more than once.")
		return nil
	}

	// It is illegal to call this after any actions are configured.
	if len(e.OneTimeActions) != 0 {
		e.reportFatalError("Times called after WillOnce.")
		return nil
	}

	if e.FallbackAction != nil {
		e.reportFatalError("Times called after WillRepeatedly.")
		return nil
	}

	// Make sure the number is reasonable (and will fit in an int).
	if n > 1000 {
		e.reportFatalError("Expectation.Times: N must be at most 1000")
		return nil
	}

	e.ExpectedNumMatches = int(n)
	return e
}

func (e *InternalExpectation) WillOnce(a Action) Expectation {
	e.mutex.Lock()
	defer e.mutex.Unlock()

	// It is illegal to call this after WillRepeatedly.
	if e.FallbackAction != nil {
		e.reportFatalError("WillOnce called after WillRepeatedly.")
		return nil
	}

	// Tell the action about the method's signature.
	if err := a.SetSignature(e.methodSignature); err != nil {
		e.reportFatalError(fmt.Sprintf("WillOnce given invalid action: %v", err))
		return nil
	}

	// Store the action.
	e.OneTimeActions = append(e.OneTimeActions, a)

	return e
}

func (e *InternalExpectation) WillRepeatedly(a Action) Expectation {
	e.mutex.Lock()
	defer e.mutex.Unlock()

	// It is illegal to call this twice.
	if e.FallbackAction != nil {
		e.reportFatalError("WillRepeatedly called more than once.")
		return nil
	}

	// Tell the action about the method's signature.
	if err := a.SetSignature(e.methodSignature); err != nil {
		e.reportFatalError(fmt.Sprintf("WillRepeatedly given invalid action: %v", err))
		return nil
	}

	// Store the action.
	e.FallbackAction = a

	return e
}

func (e *InternalExpectation) reportFatalError(errorText string) {
	e.errorReporter.ReportFatalError(e.FileName, e.LineNumber, errors.New(errorText))
}
