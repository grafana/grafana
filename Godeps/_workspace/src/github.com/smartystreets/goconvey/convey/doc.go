// Package convey contains all of the public-facing entry points to this project.
// This means that it should never be required of the user to import any other
// packages from this project as they serve internal purposes.
package convey

import (
	"fmt"

	"github.com/smartystreets/goconvey/convey/reporting"
)

////////////////////////////////// Registration //////////////////////////////////

// Convey is the method intended for use when declaring the scopes
// of a specification. Each scope has a description and a func()
// which may contain other calls to Convey(), Reset() or Should-style
// assertions. Convey calls can be nested as far as you see fit.
//
// IMPORTANT NOTE: The top-level Convey() within a Test method
// must conform to the following signature:
//
//     Convey(description string, t *testing.T, action func())
//
// All other calls should like like this (no need to pass in *testing.T):
//
//     Convey(description string, action func())
//
// Don't worry, the goconvey will panic if you get it wrong so you can fix it.
//
// All Convey()-blocks also take an optional parameter of FailureMode which
// sets how goconvey should treat failures for So()-assertions in the block and
// nested blocks. See the constants in this file for the available options.
//
// By default it will inherit from its parent block and the top-level blocks
// start with setting of FailureHalts.
//
// This parameter is inserted before the block itself:
//
//     Convey(description string, t *testing.T, mode FailureMode, action func())
//     Convey(description string, mode FailureMode, action func())
//
// See the examples package for, well, examples.
func Convey(items ...interface{}) {
	register(discover(items))
}

// SkipConvey is analagous to Convey except that the scope is not executed
// (which means that child scopes defined within this scope are not run either).
// The reporter will be notified that this step was skipped.
func SkipConvey(items ...interface{}) {
	entry := discover(items)
	entry.action = newSkippedAction(skipReport, entry.action.failureMode)

	register(entry)
}

// FocusConvey is has the inverse effect of SkipConvey. If the top-level
// Convey is changed to `FocusConvey`, only nested scopes that are defined
// with FocusConvey will be run. The rest will be ignored completely. This
// is handy when debugging a large suite that runs a misbehaving function
// repeatedly as you can disable all but one of that function
// without swaths of `SkipConvey` calls, just a targeted chain of calls
// to FocusConvey.
func FocusConvey(items ...interface{}) {
	entry := discover(items)
	entry.Focus = true

	register(entry)
}

func register(entry *registration) {
	if entry.ShouldBeTopLevel() {
		suites.Run(entry)
	} else {
		suites.Current().Register(entry)
	}
}

func skipReport() {
	suites.Current().Report(reporting.NewSkipReport())
}

// Reset registers a cleanup function to be run after each Convey()
// in the same scope. See the examples package for a simple use case.
func Reset(action func()) {
	/* TODO: Failure mode configuration */
	suites.Current().RegisterReset(newAction(action, FailureInherits))
}

/////////////////////////////////// Assertions ///////////////////////////////////

// assertion is an alias for a function with a signature that the convey.So()
// method can handle. Any future or custom assertions should conform to this
// method signature. The return value should be an empty string if the assertion
// passes and a well-formed failure message if not.
type assertion func(actual interface{}, expected ...interface{}) string

const assertionSuccess = ""

// So is the means by which assertions are made against the system under test.
// The majority of exported names in the assertions package begin with the word
// 'Should' and describe how the first argument (actual) should compare with any
// of the final (expected) arguments. How many final arguments are accepted
// depends on the particular assertion that is passed in as the assert argument.
// See the examples package for use cases and the assertions package for
// documentation on specific assertion methods.
func So(actual interface{}, assert assertion, expected ...interface{}) {
	if result := assert(actual, expected...); result == assertionSuccess {
		suites.Current().Report(reporting.NewSuccessReport())
	} else {
		suites.Current().Report(reporting.NewFailureReport(result))
	}
}

// SkipSo is analagous to So except that the assertion that would have been passed
// to So is not executed and the reporter is notified that the assertion was skipped.
func SkipSo(stuff ...interface{}) {
	skipReport()
}

// FailureMode is a type which determines how the So() blocks should fail
// if their assertion fails. See constants further down for acceptable values
type FailureMode string

const (

	// FailureContinues is a failure mode which prevents failing
	// So()-assertions from halting Convey-block execution, instead
	// allowing the test to continue past failing So()-assertions.
	FailureContinues FailureMode = "continue"

	// FailureHalts is the default setting for a top-level Convey()-block
	// and will cause all failing So()-assertions to halt further execution
	// in that test-arm and continue on to the next arm.
	FailureHalts FailureMode = "halt"

	// FailureInherits is the default setting for failure-mode, it will
	// default to the failure-mode of the parent block. You should never
	// need to specify this mode in your tests..
	FailureInherits FailureMode = "inherits"
)

var defaultFailureMode FailureMode = FailureHalts

// SetDefaultFailureMode allows you to specify the default failure mode
// for all Convey blocks. It is meant to be used in an init function to
// allow the default mode to be changd across all tests for an entire packgae
// but it can be used anywhere.
func SetDefaultFailureMode(mode FailureMode) {
	if mode == FailureContinues || mode == FailureHalts {
		defaultFailureMode = mode
	} else {
		panic("You may only use the constants named 'FailureContinues' and 'FailureHalts' as default failure modes.")
	}
}

//////////////////////////////////// Print functions ////////////////////////////////////

// Print is analogous to fmt.Print (and it even calls fmt.Print). It ensures that
// output is aligned with the corresponding scopes in the web UI.
func Print(items ...interface{}) (written int, err error) {
	fmt.Fprint(suites.Current(), items...)
	return fmt.Print(items...)
}

// Print is analogous to fmt.Println (and it even calls fmt.Println). It ensures that
// output is aligned with the corresponding scopes in the web UI.
func Println(items ...interface{}) (written int, err error) {
	fmt.Fprintln(suites.Current(), items...)
	return fmt.Println(items...)
}

// Print is analogous to fmt.Printf (and it even calls fmt.Printf). It ensures that
// output is aligned with the corresponding scopes in the web UI.
func Printf(format string, items ...interface{}) (written int, err error) {
	fmt.Fprintf(suites.Current(), format, items...)
	return fmt.Printf(format, items...)
}
