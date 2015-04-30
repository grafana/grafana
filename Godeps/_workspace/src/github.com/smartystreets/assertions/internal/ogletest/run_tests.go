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
	"reflect"
	"regexp"
	"runtime"
	"sync"
	"testing"
	"time"
)

var testFilter = flag.String("ogletest.run", "", "Regexp for matching tests to run.")

// runTestsOnce protects RunTests from executing multiple times.
var runTestsOnce sync.Once

func isAssertThatError(x interface{}) bool {
	_, ok := x.(*assertThatError)
	return ok
}

// runTest runs a single test, returning a slice of failure records for that test.
func runTest(suite interface{}, method reflect.Method) (failures []*failureRecord) {
	suiteValue := reflect.ValueOf(suite)
	suiteType := suiteValue.Type()

	// Set up a clean slate for this test. Make sure to reset it after everything
	// below is finished, so we don't accidentally use it elsewhere.
	currentlyRunningTest = newTestInfo()
	defer func() {
		currentlyRunningTest = nil
	}()

	// Create a receiver.
	suiteInstance := reflect.New(suiteType.Elem())

	// Run the SetUp method, paying attention to whether it panics.
	setUpPanicked := runWithProtection(
		func() {
			runMethodIfExists(suiteInstance, "SetUp", currentlyRunningTest)
		},
	)

	// Run the test method itself, but only if the SetUp method didn't panic.
	// (This includes AssertThat errors.)
	if !setUpPanicked {
		runWithProtection(
			func() {
				runMethodIfExists(suiteInstance, method.Name)
			},
		)
	}

	// Run the TearDown method unconditionally.
	runWithProtection(
		func() {
			runMethodIfExists(suiteInstance, "TearDown")
		},
	)

	// Tell the mock controller for the tests to report any errors it's sitting
	// on.
	currentlyRunningTest.MockController.Finish()

	return currentlyRunningTest.failureRecords
}

// RunTests runs the test suites registered with ogletest, communicating
// failures to the supplied testing.T object. This is the bridge between
// ogletest and the testing package (and gotest); you should ensure that it's
// called at least once by creating a gotest-compatible test function and
// calling it there.
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
	for _, suite := range testSuites {
		val := reflect.ValueOf(suite)
		typ := val.Type()
		suiteName := typ.Elem().Name()

		// Grab methods for the suite, filtering them to just the ones that we
		// don't need to skip.
		testMethods := filterMethods(suiteName, getMethodsInSourceOrder(typ))

		// Is there anything left to do?
		if len(testMethods) == 0 {
			continue
		}

		fmt.Printf("[----------] Running tests from %s\n", suiteName)

		// Run the SetUpTestSuite method, if any.
		runMethodIfExists(val, "SetUpTestSuite")

		// Run each method.
		for _, method := range testMethods {
			// Print a banner for the start of this test.
			fmt.Printf("[ RUN      ] %s.%s\n", suiteName, method.Name)

			// Run the test.
			startTime := time.Now()
			failures := runTest(suite, method)
			runDuration := time.Since(startTime)

			// Print any failures, and mark the test as having failed if there are any.
			for _, record := range failures {
				t.Fail()
				userErrorSection := ""
				if record.UserError != "" {
					userErrorSection = record.UserError + "\n"
				}

				fmt.Printf(
					"%s:%d:\n%s\n%s\n",
					record.FileName,
					record.LineNumber,
					record.GeneratedError,
					userErrorSection)
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
				suiteName,
				method.Name,
				timeMessage)
		}

		// Run the TearDownTestSuite method, if any.
		runMethodIfExists(val, "TearDownTestSuite")

		fmt.Printf("[----------] Finished with tests from %s\n", suiteName)
	}
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
		currentlyRunningTest.mutex.Lock()
		defer currentlyRunningTest.mutex.Unlock()

		// If the function panicked (and the panic was not due to an AssertThat
		// failure), add a failure for the panic.
		if !isAssertThatError(r) {
			// The stack looks like this:
			//
			//     <this deferred function>
			//     panic(r)
			//     <function that called panic>
			//
			_, fileName, lineNumber, ok := runtime.Caller(2)
			var panicRecord failureRecord
			if ok {
				panicRecord.FileName = path.Base(fileName)
				panicRecord.LineNumber = lineNumber
			}

			panicRecord.GeneratedError = fmt.Sprintf(
				"panic: %v\n\n%s", r, formatPanicStack())

			currentlyRunningTest.failureRecords = append(
				currentlyRunningTest.failureRecords,
				&panicRecord)
		}
	}()

	f()
	return
}

func runMethodIfExists(v reflect.Value, name string, args ...interface{}) {
	method := v.MethodByName(name)
	if method.Kind() == reflect.Invalid {
		return
	}

	if method.Type().NumIn() != len(args) {
		panic(fmt.Sprintf(
			"%s: expected %d args, actually %d.",
			name,
			len(args),
			method.Type().NumIn()))
	}

	// Create a slice of reflect.Values to pass to the method. Simultaneously
	// check types.
	argVals := make([]reflect.Value, len(args))
	for i, arg := range args {
		argVal := reflect.ValueOf(arg)

		if argVal.Type() != method.Type().In(i) {
			panic(fmt.Sprintf(
				"%s: expected arg %d to have type %v.",
				name,
				i,
				argVal.Type()))
		}

		argVals[i] = argVal
	}

	method.Call(argVals)
}

func formatPanicStack() string {
	buf := new(bytes.Buffer)

	// Walk the stack from top to bottom.
	panicPassed := false
	for i := 0; ; i++ {
		pc, file, line, ok := runtime.Caller(i)
		if !ok {
			break
		}

		// Choose a function name to display.
		funcName := "(unknown)"
		if f := runtime.FuncForPC(pc); f != nil {
			funcName = f.Name()
		}

		// Avoid stack frames at panic and above.
		if funcName == "runtime.panic" {
			panicPassed = true
			continue
		}

		if !panicPassed {
			continue
		}

		// Stop if we've gotten as far as the test runner code.
		if funcName == "github.com/smartystreets/assertions/internal/ogletest.runMethodIfExists" {
			break
		}

		// Add an entry for this frame.
		fmt.Fprintf(buf, "%s\n\t%s:%d\n", funcName, file, line)
	}

	return buf.String()
}

func filterMethods(suiteName string, in []reflect.Method) (out []reflect.Method) {
	for _, m := range in {
		// Skip set up, tear down, and unexported methods.
		if isSpecialMethod(m.Name) || !isExportedMethod(m.Name) {
			continue
		}

		// Has the user told us to skip this method?
		fullName := fmt.Sprintf("%s.%s", suiteName, m.Name)
		matched, err := regexp.MatchString(*testFilter, fullName)
		if err != nil {
			panic("Invalid value for --ogletest.run: " + err.Error())
		}

		if !matched {
			continue
		}

		out = append(out, m)
	}

	return
}

func isSpecialMethod(name string) bool {
	return (name == "SetUpTestSuite") ||
		(name == "TearDownTestSuite") ||
		(name == "SetUp") ||
		(name == "TearDown")
}

func isExportedMethod(name string) bool {
	return len(name) > 0 && name[0] >= 'A' && name[0] <= 'Z'
}
