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

// ErrorReporter is an interface that wraps methods for reporting errors that
// should cause test failures.
type ErrorReporter interface {
	// Report that some failure (e.g. an unsatisfied expectation) occurred. If
	// known, fileName and lineNumber should contain information about where it
	// occurred. The test may continue if the test framework supports it.
	ReportError(fileName string, lineNumber int, err error)

	// Like ReportError, but the test should be halted immediately. It is assumed
	// that this method does not return.
	ReportFatalError(fileName string, lineNumber int, err error)
}
