// Copyright 2012 Aaron Jacobs. All Rights Reserved.
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
	"github.com/smartystreets/assertions/internal/oglemock"
	"runtime"
)

// ExpectCall expresses an expectation that the method of the given name
// should be called on the supplied mock object. It returns a function that
// should be called with the expected arguments, matchers for the arguments,
// or a mix of both.
//
// For example:
//
//     mockWriter := [...]
//     ogletest.ExpectCall(mockWriter, "Write")(oglematchers.ElementsAre(0x1))
//         .WillOnce(oglemock.Return(1, nil))
//
// This is a shortcut for calling i.MockController.ExpectCall, where i is the
// TestInfo struct for the currently-running test. Unlike that direct approach,
// this function automatically sets the correct file name and line number for
// the expectation.
func ExpectCall(o oglemock.MockObject, method string) oglemock.PartialExpecation {
	// Get information about the call site.
	_, file, lineNumber, ok := runtime.Caller(1)
	if !ok {
		panic("ExpectCall: runtime.Caller")
	}

	// Grab the current test info.
	info := currentlyRunningTest
	if info == nil {
		panic("ExpectCall: no test info.")
	}

	// Grab the mock controller.
	controller := currentlyRunningTest.MockController
	if controller == nil {
		panic("ExpectCall: no mock controller.")
	}

	// Report the expectation.
	return controller.ExpectCall(o, method, file, lineNumber)
}
