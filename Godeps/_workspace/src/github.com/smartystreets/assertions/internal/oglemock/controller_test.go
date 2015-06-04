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

package oglemock_test

import (
	. "github.com/smartystreets/assertions/internal/oglematchers"
	. "github.com/smartystreets/assertions/internal/oglemock"
	. "github.com/smartystreets/assertions/internal/ogletest"
	"reflect"
)

////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////

type errorReport struct {
	fileName   string
	lineNumber int
	err        error
}

type fakeErrorReporter struct {
	errors      []errorReport
	fatalErrors []errorReport
}

func (r *fakeErrorReporter) ReportError(fileName string, lineNumber int, err error) {
	report := errorReport{fileName, lineNumber, err}
	r.errors = append(r.errors, report)
}

func (r *fakeErrorReporter) ReportFatalError(fileName string, lineNumber int, err error) {
	report := errorReport{fileName, lineNumber, err}
	r.fatalErrors = append(r.fatalErrors, report)
}

type trivialMockObject struct {
	id   uintptr
	desc string
}

func (o *trivialMockObject) Oglemock_Id() uintptr {
	return o.id
}

func (o *trivialMockObject) Oglemock_Description() string {
	return o.desc
}

// Method being mocked
func (o *trivialMockObject) StringToInt(s string) int {
	return 0
}

// Method being mocked
func (o *trivialMockObject) TwoIntsToString(i, j int) string {
	return ""
}

type ControllerTest struct {
	reporter   fakeErrorReporter
	controller Controller

	mock1 MockObject
	mock2 MockObject
}

func (t *ControllerTest) SetUp(c *TestInfo) {
	t.reporter.errors = make([]errorReport, 0)
	t.reporter.fatalErrors = make([]errorReport, 0)
	t.controller = NewController(&t.reporter)

	t.mock1 = &trivialMockObject{17, "taco"}
	t.mock2 = &trivialMockObject{19, "burrito"}
}

func init() { RegisterTestSuite(&ControllerTest{}) }

////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////

func (t *ControllerTest) FinishWithoutAnyEvents() {
	t.controller.Finish()
	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) HandleCallForUnknownObject() {
	p := []byte{255}
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"taco.go",
		112,
		[]interface{}{p})

	// The error should be reported immediately.
	AssertEq(1, len(t.reporter.errors))
	AssertEq(0, len(t.reporter.fatalErrors))

	ExpectEq("taco.go", t.reporter.errors[0].fileName)
	ExpectEq(112, t.reporter.errors[0].lineNumber)
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("Unexpected")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("StringToInt")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("[255]")))

	// Finish should change nothing.
	t.controller.Finish()

	ExpectEq(1, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) ExpectCallForUnknownMethod() {
	ExpectEq(
		nil,
		t.controller.ExpectCall(t.mock1, "Frobnicate", "burrito.go", 117))

	// A fatal error should be reported immediately.
	AssertEq(0, len(t.reporter.errors))
	AssertEq(1, len(t.reporter.fatalErrors))

	report := t.reporter.fatalErrors[0]
	ExpectEq("burrito.go", report.fileName)
	ExpectEq(117, report.lineNumber)
	ExpectThat(report.err, Error(HasSubstr("Unknown method")))
	ExpectThat(report.err, Error(HasSubstr("Frobnicate")))
}

func (t *ControllerTest) PartialExpectationGivenWrongNumberOfArgs() {
	ExpectEq(
		nil,
		t.controller.ExpectCall(t.mock1, "TwoIntsToString", "burrito.go", 117)(
			17, 19, 23))

	// A fatal error should be reported immediately.
	AssertEq(0, len(t.reporter.errors))
	AssertEq(1, len(t.reporter.fatalErrors))

	report := t.reporter.fatalErrors[0]
	ExpectEq("burrito.go", report.fileName)
	ExpectEq(117, report.lineNumber)
	ExpectThat(report.err, Error(HasSubstr("TwoIntsToString")))
	ExpectThat(report.err, Error(HasSubstr("arguments")))
	ExpectThat(report.err, Error(HasSubstr("expected 2")))
	ExpectThat(report.err, Error(HasSubstr("got 3")))
}

func (t *ControllerTest) PartialExpectationCalledTwice() {
	partial := t.controller.ExpectCall(t.mock1, "StringToInt", "burrito.go", 117)
	AssertNe(nil, partial("taco"))
	ExpectEq(nil, partial("taco"))

	// A fatal error should be reported immediately.
	AssertEq(0, len(t.reporter.errors))
	AssertEq(1, len(t.reporter.fatalErrors))

	report := t.reporter.fatalErrors[0]
	ExpectEq("burrito.go", report.fileName)
	ExpectEq(117, report.lineNumber)
	ExpectThat(report.err, Error(HasSubstr("called more than once")))
}

func (t *ControllerTest) HandleMethodCallForUnknownMethod() {
	ExpectEq(
		nil,
		t.controller.HandleMethodCall(
			t.mock1,
			"Frobnicate",
			"burrito.go",
			117,
			[]interface{}{}))

	// A fatal error should be reported immediately.
	AssertEq(0, len(t.reporter.errors))
	AssertEq(1, len(t.reporter.fatalErrors))

	report := t.reporter.fatalErrors[0]
	ExpectEq("burrito.go", report.fileName)
	ExpectEq(117, report.lineNumber)
	ExpectThat(report.err, Error(HasSubstr("Unknown method")))
	ExpectThat(report.err, Error(HasSubstr("Frobnicate")))
}

func (t *ControllerTest) HandleMethodCallGivenWrongNumberOfArgs() {
	t.controller.ExpectCall(t.mock1, "TwoIntsToString", "", 0)(17, 19)

	ExpectEq(
		nil,
		t.controller.HandleMethodCall(
			t.mock1,
			"TwoIntsToString",
			"burrito.go",
			117,
			[]interface{}{17, 19, 23}))

	// A fatal error should be reported immediately.
	AssertEq(0, len(t.reporter.errors))
	AssertEq(1, len(t.reporter.fatalErrors))

	report := t.reporter.fatalErrors[0]
	ExpectEq("burrito.go", report.fileName)
	ExpectEq(117, report.lineNumber)
	ExpectThat(report.err, Error(HasSubstr("arguments")))
	ExpectThat(report.err, Error(HasSubstr("expected 2")))
	ExpectThat(report.err, Error(HasSubstr("got 3")))
}

func (t *ControllerTest) ExpectThenNonMatchingCall() {
	// Expectation -- set up a fallback action to make it optional.
	partial := t.controller.ExpectCall(
		t.mock1,
		"TwoIntsToString",
		"burrito.go",
		117)

	exp := partial(LessThan(10), Equals(2))
	exp.WillRepeatedly(Return(""))

	// Call
	t.controller.HandleMethodCall(
		t.mock1,
		"TwoIntsToString",
		"taco.go",
		112,
		[]interface{}{8, 1})

	// The error should be reported immediately.
	AssertEq(1, len(t.reporter.errors))
	AssertEq(0, len(t.reporter.fatalErrors))

	ExpectEq("taco.go", t.reporter.errors[0].fileName)
	ExpectEq(112, t.reporter.errors[0].lineNumber)
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("Unexpected")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("TwoIntsToString")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("[8 1]")))

	// Finish should change nothing.
	t.controller.Finish()

	ExpectEq(1, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) ExplicitCardinalityNotSatisfied() {
	// Expectation -- set up an explicit cardinality of three.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.Times(3)

	// Call twice.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// The error should not yet be reported.
	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))

	// Finish should cause the error to be reported.
	t.controller.Finish()

	AssertEq(1, len(t.reporter.errors))
	AssertEq(0, len(t.reporter.fatalErrors))

	ExpectEq("burrito.go", t.reporter.errors[0].fileName)
	ExpectEq(117, t.reporter.errors[0].lineNumber)
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("Unsatisfied")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("StringToInt")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("at least 3 times")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("called 2 times")))
}

func (t *ControllerTest) ImplicitOneTimeActionCountNotSatisfied() {
	// Expectation -- add three one-time actions.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillOnce(Return(0))
	exp.WillOnce(Return(1))
	exp.WillOnce(Return(2))

	// Call twice.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// The error should not yet be reported.
	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))

	// Finish should cause the error to be reported.
	t.controller.Finish()

	AssertEq(1, len(t.reporter.errors))
	AssertEq(0, len(t.reporter.fatalErrors))

	ExpectEq("burrito.go", t.reporter.errors[0].fileName)
	ExpectEq(117, t.reporter.errors[0].lineNumber)
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("Unsatisfied")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("StringToInt")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("at least 3 times")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("called 2 times")))
}

func (t *ControllerTest) ImplicitOneTimeActionLowerBoundNotSatisfied() {
	// Expectation -- add three one-time actions and a fallback.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillOnce(Return(0))
	exp.WillOnce(Return(1))
	exp.WillOnce(Return(2))
	exp.WillRepeatedly(Return(3))

	// Call twice.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// The error should not yet be reported.
	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))

	// Finish should cause the error to be reported.
	t.controller.Finish()

	AssertEq(1, len(t.reporter.errors))
	AssertEq(0, len(t.reporter.fatalErrors))

	ExpectEq("burrito.go", t.reporter.errors[0].fileName)
	ExpectEq(117, t.reporter.errors[0].lineNumber)
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("Unsatisfied")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("StringToInt")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("at least 3 times")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("called 2 times")))
}

func (t *ControllerTest) ImplicitCardinalityOfOneNotSatisfied() {
	// Expectation -- add no actions.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	partial(HasSubstr(""))

	// Don't call.

	// The error should not yet be reported.
	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))

	// Finish should cause the error to be reported.
	t.controller.Finish()

	AssertEq(1, len(t.reporter.errors))
	AssertEq(0, len(t.reporter.fatalErrors))

	ExpectEq("burrito.go", t.reporter.errors[0].fileName)
	ExpectEq(117, t.reporter.errors[0].lineNumber)
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("Unsatisfied")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("StringToInt")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("at least 1 time")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("called 0 times")))
}

func (t *ControllerTest) ExplicitCardinalityOverrun() {
	// Expectation -- call times(2).
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.Times(2)

	// Call three times.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// The error should be reported immediately.
	AssertEq(1, len(t.reporter.errors))
	AssertEq(0, len(t.reporter.fatalErrors))

	ExpectEq("burrito.go", t.reporter.errors[0].fileName)
	ExpectEq(117, t.reporter.errors[0].lineNumber)
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("Unexpected")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("StringToInt")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("at most 2 times")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("called 3 times")))

	// Finish should change nothing.
	t.controller.Finish()

	ExpectEq(1, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) ImplicitOneTimeActionCountOverrun() {
	// Expectation -- add a one-time action.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillOnce(Return(0))

	// Call twice.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// The error should be reported immediately.
	AssertEq(1, len(t.reporter.errors))
	AssertEq(0, len(t.reporter.fatalErrors))

	ExpectEq("burrito.go", t.reporter.errors[0].fileName)
	ExpectEq(117, t.reporter.errors[0].lineNumber)
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("Unexpected")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("StringToInt")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("at most 1 time")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("called 2 times")))

	// Finish should change nothing.
	t.controller.Finish()

	ExpectEq(1, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) ImplicitCardinalityOfOneOverrun() {
	// Expectation -- don't add any actions.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	partial(HasSubstr(""))

	// Call twice.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// The error should be reported immediately.
	AssertEq(1, len(t.reporter.errors))
	AssertEq(0, len(t.reporter.fatalErrors))

	ExpectEq("burrito.go", t.reporter.errors[0].fileName)
	ExpectEq(117, t.reporter.errors[0].lineNumber)
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("Unexpected")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("StringToInt")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("at most 1 time")))
	ExpectThat(t.reporter.errors[0].err, Error(HasSubstr("called 2 times")))

	// Finish should change nothing.
	t.controller.Finish()

	ExpectEq(1, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) ExplicitCardinalitySatisfied() {
	// Expectation -- set up an explicit cardinality of two.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.Times(2)

	// Call twice.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// There should be no errors.
	t.controller.Finish()

	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) ImplicitOneTimeActionCountSatisfied() {
	// Expectation -- set up two one-time actions.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillOnce(Return(0))
	exp.WillOnce(Return(1))

	// Call twice.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// There should be no errors.
	t.controller.Finish()

	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) ImplicitOneTimeActionLowerBoundJustSatisfied() {
	// Expectation -- set up two one-time actions and a fallback.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillOnce(Return(0))
	exp.WillOnce(Return(1))
	exp.WillRepeatedly(Return(2))

	// Call twice.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// There should be no errors.
	t.controller.Finish()

	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) ImplicitOneTimeActionLowerBoundMoreThanSatisfied() {
	// Expectation -- set up two one-time actions and a fallback.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillOnce(Return(0))
	exp.WillOnce(Return(1))
	exp.WillRepeatedly(Return(2))

	// Call four times.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// There should be no errors.
	t.controller.Finish()

	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) FallbackActionConfiguredWithZeroCalls() {
	// Expectation -- set up a fallback action.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillRepeatedly(Return(0))

	// Don't call.

	// There should be no errors.
	t.controller.Finish()

	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) FallbackActionConfiguredWithMultipleCalls() {
	// Expectation -- set up a fallback action.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillRepeatedly(Return(0))

	// Call twice.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// There should be no errors.
	t.controller.Finish()

	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) ImplicitCardinalityOfOneSatisfied() {
	// Expectation -- don't add actions.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	partial(HasSubstr(""))

	// Call once.
	t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	// There should be no errors.
	t.controller.Finish()

	ExpectEq(0, len(t.reporter.errors))
	ExpectEq(0, len(t.reporter.fatalErrors))
}

func (t *ControllerTest) InvokesOneTimeActions() {
	var res []interface{}

	// Expectation -- set up two one-time actions.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	suppliedArg := ""
	expectedReturn := 17

	f := func(s string) int {
		suppliedArg = s
		return expectedReturn
	}

	exp := partial(HasSubstr(""))
	exp.WillOnce(Invoke(f))
	exp.WillOnce(Return(1))

	AssertThat(t.reporter.fatalErrors, ElementsAre())

	// Call 0
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{"taco"})

	ExpectEq("taco", suppliedArg)
	ExpectThat(res, ElementsAre(IdenticalTo(expectedReturn)))

	// Call 1
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(1))
}

func (t *ControllerTest) InvokesFallbackActionAfterOneTimeActions() {
	var res []interface{}

	// Expectation -- set up two one-time actions and a fallback.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillOnce(Return(0))
	exp.WillOnce(Return(1))
	exp.WillRepeatedly(Return(2))

	// Call 0
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(0))

	// Call 1
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(1))

	// Call 2
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(2))

	// Call 3
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(2))
}

func (t *ControllerTest) InvokesFallbackActionWithoutOneTimeActions() {
	var res []interface{}

	// Expectation -- set up only a fallback action.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillRepeatedly(Return(2))

	// Call 0
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(2))

	// Call 1
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(2))

	// Call 2
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(2))
}

func (t *ControllerTest) ImplicitActionReturnsZeroInts() {
	var res []interface{}

	// Expectation -- set up a cardinality of two.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.Times(2)

	// Call 0
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(reflect.TypeOf(res[0]), Equals(reflect.TypeOf(int(0))))
	ExpectThat(res[0], Equals(0))

	// Call 1
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(reflect.TypeOf(res[0]), Equals(reflect.TypeOf(int(0))))
	ExpectThat(res[0], Equals(0))
}

func (t *ControllerTest) ImplicitActionReturnsEmptyStrings() {
	var res []interface{}

	// Expectation -- set up a cardinality of two.
	partial := t.controller.ExpectCall(
		t.mock1,
		"TwoIntsToString",
		"burrito.go",
		117)

	exp := partial(LessThan(100), LessThan(100))
	exp.Times(2)

	// Call 0
	res = t.controller.HandleMethodCall(
		t.mock1,
		"TwoIntsToString",
		"",
		0,
		[]interface{}{0, 0})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(""))

	// Call 1
	res = t.controller.HandleMethodCall(
		t.mock1,
		"TwoIntsToString",
		"",
		0,
		[]interface{}{0, 0})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(""))
}

func (t *ControllerTest) ExpectationsAreMatchedLastToFirst() {
	var res []interface{}

	// General expectation
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillRepeatedly(Return(17))

	// More specific expectation
	partial = t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp = partial(Equals("taco"))
	exp.WillRepeatedly(Return(19))

	// Call -- the second expectation should match.
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{"taco"})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(19))

	// Call -- the first expectation should match because the second doesn't.
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{"burrito"})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(17))
}

func (t *ControllerTest) ExpectationsAreSegregatedByMockObject() {
	var res []interface{}

	// Expectation for mock1 -- return 17.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillRepeatedly(Return(17))

	// Expectation for mock2 -- return 19.
	partial = t.controller.ExpectCall(
		t.mock2,
		"StringToInt",
		"burrito.go",
		117)

	exp = partial(HasSubstr(""))
	exp.WillRepeatedly(Return(19))

	// Call mock1.
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(17))

	// Call mock2.
	res = t.controller.HandleMethodCall(
		t.mock2,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(19))
}

func (t *ControllerTest) ExpectationsAreSegregatedByMethodName() {
	var res []interface{}

	// Expectation for StringToInt
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillRepeatedly(Return(17))

	// Expectation for TwoIntsToString
	partial = t.controller.ExpectCall(
		t.mock1,
		"TwoIntsToString",
		"burrito.go",
		117)

	exp = partial(1, 2)
	exp.WillRepeatedly(Return("taco"))

	// Call StringToInt.
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals(17))

	// Call TwoIntsToString.
	res = t.controller.HandleMethodCall(
		t.mock1,
		"TwoIntsToString",
		"",
		0,
		[]interface{}{1, 2})

	ExpectThat(len(res), Equals(1))
	ExpectThat(res[0], Equals("taco"))
}

func (t *ControllerTest) ActionCallsAgainMatchingDifferentExpectation() {
	var res []interface{}

	// Expectation for StringToInt
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.WillOnce(Return(17))

	// Expectation for TwoIntsToString -- pretend we call StringToInt.
	partial = t.controller.ExpectCall(
		t.mock1,
		"TwoIntsToString",
		"burrito.go",
		117)

	exp = partial(1, 2)
	exp.WillOnce(Invoke(func(int, int) string {
		t.controller.HandleMethodCall(
			t.mock1,
			"StringToInt",
			"taco.go",
			112,
			[]interface{}{""})

		return "queso"
	}))

	// Call TwoIntsToString.
	res = t.controller.HandleMethodCall(
		t.mock1,
		"TwoIntsToString",
		"",
		0,
		[]interface{}{1, 2})

	AssertThat(res, ElementsAre("queso"))

	// Finish. Everything should be satisfied.
	t.controller.Finish()

	ExpectThat(t.reporter.errors, ElementsAre())
	ExpectThat(t.reporter.fatalErrors, ElementsAre())
}

func (t *ControllerTest) ActionCallsAgainMatchingSameExpectation() {
	var res []interface{}

	// Expectation for StringToInt -- should be called twice. The first time it
	// should call itself.
	partial := t.controller.ExpectCall(
		t.mock1,
		"StringToInt",
		"burrito.go",
		117)

	exp := partial(HasSubstr(""))
	exp.Times(2)
	exp.WillOnce(Invoke(func(string) int {
		subCallRes := t.controller.HandleMethodCall(
			t.mock1,
			"StringToInt",
			"taco.go",
			112,
			[]interface{}{""})

		return subCallRes[0].(int) + 19
	}))

	exp.WillOnce(Return(17))

	// Call.
	res = t.controller.HandleMethodCall(
		t.mock1,
		"StringToInt",
		"",
		0,
		[]interface{}{""})

	AssertThat(res, ElementsAre(17+19))

	// Finish. Everything should be satisfied.
	t.controller.Finish()

	ExpectThat(t.reporter.errors, ElementsAre())
	ExpectThat(t.reporter.fatalErrors, ElementsAre())
}
