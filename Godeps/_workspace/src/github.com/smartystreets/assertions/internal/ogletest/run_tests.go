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
	"bytes"
	"flag"
	"fmt"
	"path"
	"regexp"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/smartystreets/assertions/internal/reqtrace"
)

var fTestFilter = flag.String(
	"ogletest.run",
	"",
	"Regexp for matching tests to run.")

var fStopEarly = flag.Bool(
	"ogletest.stop_early",
	false,
	"If true, stop after the first failure.")

// runTestsOnce protects RunTests from executing multiple times.
var runTestsOnce sync.Once

func isAbortError(x interface{}) bool {
	_, ok := x.(abortError)
	return ok
}

// Run a single test function, returning a slice of failure records.
func runTestFunction(tf TestFunction) (failures []FailureRecord) {
	// Set up a clean slate for this test. Make sure to reset it after everything
	// below is finished, so we don't accidentally use it elsewhere.
	currentlyRunningTest = newTestInfo()
	defer func() {
		currentlyRunningTest = nil
	}()

	ti := currentlyRunningTest

	// Start a trace.
	var reportOutcome reqtrace.ReportFunc
	ti.Ctx, reportOutcome = reqtrace.Trace(ti.Ctx, tf.Name)

	// Run the SetUp function, if any, paying attention to whether it panics.
	setUpPanicked := false
	if tf.SetUp != nil {
		setUpPanicked = runWithProtection(func() { tf.SetUp(ti) })
	}

	// Run the test function itself, but only if the SetUp function didn't panic.
	// (This includes AssertThat errors.)
	if !setUpPanicked {
		runWithProtection(tf.Run)
	}

	// Run the TearDown function, if any.
	if tf.TearDown != nil {
		runWithProtection(tf.TearDown)
	}

	// Tell the mock controller for the tests to report any errors it's sitting
	// on.
	ti.MockController.Finish()

	// Report the outcome to reqtrace.
	if len(ti.failureRecords) == 0 {
		reportOutcome(nil)
	} else {
		reportOutcome(fmt.Errorf("%v failure records", len(ti.failureRecords)))
	}

	return ti.failureRecords
}

// Run everything registered with Register (including via the wrapper
// RegisterTestSuite).
//
// Failures are communicated to the supplied testing.T object. This is the
// bridge between ogletest and the testing package (and `go test`); you should
// ensure that it's called at least once by creating a test function compatible
// with `go test` and calling it there.
//
// For example:
//
//     import (
//       "github.com/smartystreets/assertions/internal/ogletest"
//       "testing"
//     )
//
//     func TestOgletest(t *testing.T) {
//       ogletest.RunTests(t)
//     }
//
func RunTests(t *testing.T) {
	runTestsOnce.Do(func() { runTestsInternal(t) })
}

// runTestsInternal does the real work of RunTests, which simply wraps it in a
// sync.Once.
func runTestsInternal(t *testing.T) {
	// Process each registered suite.
	for _, suite := range registeredSuites {
		// Stop now if we've already seen a failure and we've been told to stop
		// early.
		if t.Failed() && *fStopEarly {
			break
		}

		// Print a banner.
		fmt.Printf("[----------] Running tests from %s\n", suite.Name)

		// Run the SetUp function, if any.
		if suite.SetUp != nil {
			suite.SetUp()
		}

		// Run each test function that the user has not told us to skip.
		for _, tf := range filterTestFunctions(suite) {
			// Print a banner for the start of this test function.
			fmt.Printf("[ RUN      ] %s.%s\n", suite.Name, tf.Name)

			// Run the test function.
			startTime := time.Now()
			failures := runTestFunction(tf)
			runDuration := time.Since(startTime)

			// Print any failures, and mark the test as having failed if there are any.
			for _, record := range failures {
				t.Fail()
				fmt.Printf(
					"%s:%d:\n%s\n\n",
					record.FileName,
					record.LineNumber,
					record.Error)
			}

			// Print a banner for the end of the test.
			bannerMessage := "[       OK ]"
			if len(failures) != 0 {
				bannerMessage = "[  FAILED  ]"
			}

			// Print a summary of the time taken, if long enough.
			var timeMessage string
			if runDuration >= 25*time.Millisecond {
				timeMessage = fmt.Sprintf(" (%s)", runDuration.String())
			}

			fmt.Printf(
				"%s %s.%s%s\n",
				bannerMessage,
				suite.Name,
				tf.Name,
				timeMessage)

			// Stop running tests from this suite if we've been told to stop early
			// and this test failed.
			if t.Failed() && *fStopEarly {
				break
			}
		}

		// Run the suite's TearDown function, if any.
		if suite.TearDown != nil {
			suite.TearDown()
		}

		fmt.Printf("[----------] Finished with tests from %s\n", suite.Name)
	}
}

// Return true iff the supplied program counter appears to lie within panic().
func isPanic(pc uintptr) bool {
	f := runtime.FuncForPC(pc)
	if f == nil {
		return false
	}

	return f.Name() == "runtime.gopanic" || f.Name() == "runtime.sigpanic"
}

// Find the deepest stack frame containing something that appears to be a
// panic. Return the 'skip' value that a caller to this function would need
// to supply to runtime.Caller for that frame, or a negative number if not found.
func findPanic() int {
	localSkip := -1
	for i := 0; ; i++ {
		// Stop if we've passed the base of the stack.
		pc, _, _, ok := runtime.Caller(i)
		if !ok {
			break
		}

		// Is this a panic?
		if isPanic(pc) {
			localSkip = i
		}
	}

	return localSkip - 1
}

// Attempt to find the file base name and line number for the ultimate source
// of a panic, on the panicking stack. Return a human-readable sentinel if
// unsuccessful.
func findPanicFileLine() (string, int) {
	panicSkip := findPanic()
	if panicSkip < 0 {
		return "(unknown)", 0
	}

	// Find the trigger of the panic.
	_, file, line, ok := runtime.Caller(panicSkip + 1)
	if !ok {
		return "(unknown)", 0
	}

	return path.Base(file), line
}

// Run the supplied function, catching panics (including AssertThat errors) and
// reporting them to the currently-running test as appropriate. Return true iff
// the function panicked.
func runWithProtection(f func()) (panicked bool) {
	defer func() {
		// If the test didn't panic, we're done.
		r := recover()
		if r == nil {
			return
		}

		panicked = true

		// We modify the currently running test below.
		currentlyRunningTest.mu.Lock()
		defer currentlyRunningTest.mu.Unlock()

		// If the function panicked (and the panic was not due to an AssertThat
		// failure), add a failure for the panic.
		if !isAbortError(r) {
			var panicRecord FailureRecord
			panicRecord.FileName, panicRecord.LineNumber = findPanicFileLine()
			panicRecord.Error = fmt.Sprintf(
				"panic: %v\n\n%s", r, formatPanicStack())

			currentlyRunningTest.failureRecords = append(
				currentlyRunningTest.failureRecords,
				panicRecord)
		}
	}()

	f()
	return
}

func formatPanicStack() string {
	buf := new(bytes.Buffer)

	// Find the panic. If successful, we'll skip to below it. Otherwise, we'll
	// format everything.
	var initialSkip int
	if panicSkip := findPanic(); panicSkip >= 0 {
		initialSkip = panicSkip + 1
	}

	for i := initialSkip; ; i++ {
		pc, file, line, ok := runtime.Caller(i)
		if !ok {
			break
		}

		// Choose a function name to display.
		funcName := "(unknown)"
		if f := runtime.FuncForPC(pc); f != nil {
			funcName = f.Name()
		}

		// Stop if we've gotten as far as the test runner code.
		if funcName == "github.com/smartystreets/assertions/internal/ogletest.runTestMethod" ||
			funcName == "github.com/smartystreets/assertions/internal/ogletest.runWithProtection" {
			break
		}

		// Add an entry for this frame.
		fmt.Fprintf(buf, "%s\n\t%s:%d\n", funcName, file, line)
	}

	return buf.String()
}

// Filter test functions according to the user-supplied filter flag.
func filterTestFunctions(suite TestSuite) (out []TestFunction) {
	re, err := regexp.Compile(*fTestFilter)
	if err != nil {
		panic("Invalid value for --ogletest.run: " + err.Error())
	}

	for _, tf := range suite.TestFunctions {
		fullName := fmt.Sprintf("%s.%s", suite.Name, tf.Name)
		if !re.MatchString(fullName) {
			continue
		}

		out = append(out, tf)
	}

	return
}
