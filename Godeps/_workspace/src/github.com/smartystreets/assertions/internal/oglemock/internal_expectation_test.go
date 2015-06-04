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

var emptyReturnSig reflect.Type = reflect.TypeOf(func(i int) {})
var float64ReturnSig reflect.Type = reflect.TypeOf(func(i int) float64 { return 17.0 })

type InternalExpectationTest struct {
	reporter fakeErrorReporter
}

func init() { RegisterTestSuite(&InternalExpectationTest{}) }

func (t *InternalExpectationTest) SetUp(c *TestInfo) {
	t.reporter.errors = make([]errorReport, 0)
	t.reporter.fatalErrors = make([]errorReport, 0)
}

func (t *InternalExpectationTest) makeExpectation(
	sig reflect.Type,
	args []interface{},
	fileName string,
	lineNumber int) *InternalExpectation {
	return InternalNewExpectation(&t.reporter, sig, args, fileName, lineNumber)
}

////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////

func (t *InternalExpectationTest) StoresFileNameAndLineNumber() {
	args := []interface{}{}
	exp := t.makeExpectation(emptyReturnSig, args, "taco", 17)

	ExpectThat(exp.FileName, Equals("taco"))
	ExpectThat(exp.LineNumber, Equals(17))
}

func (t *InternalExpectationTest) NoArgs() {
	args := []interface{}{}
	exp := t.makeExpectation(emptyReturnSig, args, "", 0)

	ExpectThat(len(exp.ArgMatchers), Equals(0))
}

func (t *InternalExpectationTest) MixOfMatchersAndNonMatchers() {
	args := []interface{}{Equals(17), 19, Equals(23)}
	exp := t.makeExpectation(emptyReturnSig, args, "", 0)

	// Matcher args
	ExpectThat(len(exp.ArgMatchers), Equals(3))
	ExpectThat(exp.ArgMatchers[0], Equals(args[0]))
	ExpectThat(exp.ArgMatchers[2], Equals(args[2]))

	// Non-matcher arg
	var err error
	matcher1 := exp.ArgMatchers[1]

	err = matcher1.Matches(17)
	ExpectNe(nil, err)

	err = matcher1.Matches(19)
	ExpectEq(nil, err)

	err = matcher1.Matches(23)
	ExpectNe(nil, err)
}

func (t *InternalExpectationTest) NoTimes() {
	exp := t.makeExpectation(emptyReturnSig, []interface{}{}, "", 0)

	ExpectThat(exp.ExpectedNumMatches, Equals(-1))
}

func (t *InternalExpectationTest) TimesN() {
	exp := t.makeExpectation(emptyReturnSig, []interface{}{}, "", 0)
	exp.Times(17)

	ExpectThat(exp.ExpectedNumMatches, Equals(17))
}

func (t *InternalExpectationTest) NoActions() {
	exp := t.makeExpectation(emptyReturnSig, []interface{}{}, "", 0)

	ExpectThat(len(exp.OneTimeActions), Equals(0))
	ExpectThat(exp.FallbackAction, Equals(nil))
}

func (t *InternalExpectationTest) WillOnce() {
	action0 := Return(17.0)
	action1 := Return(19.0)

	exp := t.makeExpectation(float64ReturnSig, []interface{}{}, "", 0)
	exp.WillOnce(action0).WillOnce(action1)

	ExpectThat(len(exp.OneTimeActions), Equals(2))
	ExpectThat(exp.OneTimeActions[0], Equals(action0))
	ExpectThat(exp.OneTimeActions[1], Equals(action1))
}

func (t *InternalExpectationTest) WillRepeatedly() {
	action := Return(17.0)

	exp := t.makeExpectation(float64ReturnSig, []interface{}{}, "", 0)
	exp.WillRepeatedly(action)

	ExpectThat(exp.FallbackAction, Equals(action))
}

func (t *InternalExpectationTest) BothKindsOfAction() {
	action0 := Return(17.0)
	action1 := Return(19.0)
	action2 := Return(23.0)

	exp := t.makeExpectation(float64ReturnSig, []interface{}{}, "", 0)
	exp.WillOnce(action0).WillOnce(action1).WillRepeatedly(action2)

	ExpectThat(len(exp.OneTimeActions), Equals(2))
	ExpectThat(exp.OneTimeActions[0], Equals(action0))
	ExpectThat(exp.OneTimeActions[1], Equals(action1))
	ExpectThat(exp.FallbackAction, Equals(action2))
}

func (t *InternalExpectationTest) TimesCalledWithHugeNumber() {
	exp := t.makeExpectation(emptyReturnSig, []interface{}{}, "taco.go", 112)
	exp.Times(1 << 30)

	AssertEq(1, len(t.reporter.fatalErrors))
	AssertEq(0, len(t.reporter.errors))

	r := t.reporter.fatalErrors[0]
	ExpectEq("taco.go", r.fileName)
	ExpectEq(112, r.lineNumber)
	ExpectThat(r.err, Error(HasSubstr("Times")))
	ExpectThat(r.err, Error(HasSubstr("N must be at most 1000")))
}

func (t *InternalExpectationTest) TimesCalledTwice() {
	exp := t.makeExpectation(emptyReturnSig, []interface{}{}, "taco.go", 112)
	exp.Times(17)
	exp.Times(17)

	AssertEq(1, len(t.reporter.fatalErrors))
	AssertEq(0, len(t.reporter.errors))

	r := t.reporter.fatalErrors[0]
	ExpectEq("taco.go", r.fileName)
	ExpectEq(112, r.lineNumber)
	ExpectThat(r.err, Error(HasSubstr("Times")))
	ExpectThat(r.err, Error(HasSubstr("more than once")))
}

func (t *InternalExpectationTest) TimesCalledAfterWillOnce() {
	exp := t.makeExpectation(emptyReturnSig, []interface{}{}, "taco.go", 112)
	exp.WillOnce(Return())
	exp.Times(17)

	AssertEq(1, len(t.reporter.fatalErrors))
	AssertEq(0, len(t.reporter.errors))

	r := t.reporter.fatalErrors[0]
	ExpectEq("taco.go", r.fileName)
	ExpectEq(112, r.lineNumber)
	ExpectThat(r.err, Error(HasSubstr("Times")))
	ExpectThat(r.err, Error(HasSubstr("after WillOnce")))
}

func (t *InternalExpectationTest) TimesCalledAfterWillRepeatedly() {
	exp := t.makeExpectation(emptyReturnSig, []interface{}{}, "taco.go", 112)
	exp.WillRepeatedly(Return())
	exp.Times(17)

	AssertEq(1, len(t.reporter.fatalErrors))
	AssertEq(0, len(t.reporter.errors))

	r := t.reporter.fatalErrors[0]
	ExpectEq("taco.go", r.fileName)
	ExpectEq(112, r.lineNumber)
	ExpectThat(r.err, Error(HasSubstr("Times")))
	ExpectThat(r.err, Error(HasSubstr("after WillRepeatedly")))
}

func (t *InternalExpectationTest) WillOnceCalledAfterWillRepeatedly() {
	exp := t.makeExpectation(emptyReturnSig, []interface{}{}, "taco.go", 112)
	exp.WillRepeatedly(Return())
	exp.WillOnce(Return())

	AssertEq(1, len(t.reporter.fatalErrors))
	AssertEq(0, len(t.reporter.errors))

	r := t.reporter.fatalErrors[0]
	ExpectEq("taco.go", r.fileName)
	ExpectEq(112, r.lineNumber)
	ExpectThat(r.err, Error(HasSubstr("WillOnce")))
	ExpectThat(r.err, Error(HasSubstr("after WillRepeatedly")))
}

func (t *InternalExpectationTest) OneTimeActionRejectsSignature() {
	exp := t.makeExpectation(float64ReturnSig, []interface{}{}, "taco.go", 112)
	exp.WillOnce(Return("taco"))

	AssertEq(1, len(t.reporter.fatalErrors))
	AssertEq(0, len(t.reporter.errors))

	r := t.reporter.fatalErrors[0]
	ExpectEq("taco.go", r.fileName)
	ExpectEq(112, r.lineNumber)
	ExpectThat(r.err, Error(HasSubstr("arg 0")))
	ExpectThat(r.err, Error(HasSubstr("expected float64")))
	ExpectThat(r.err, Error(HasSubstr("given string")))
}

func (t *InternalExpectationTest) WillRepeatedlyCalledTwice() {
	exp := t.makeExpectation(emptyReturnSig, []interface{}{}, "taco.go", 112)
	exp.WillRepeatedly(Return())
	exp.WillRepeatedly(Return())

	AssertEq(1, len(t.reporter.fatalErrors))
	AssertEq(0, len(t.reporter.errors))

	r := t.reporter.fatalErrors[0]
	ExpectEq("taco.go", r.fileName)
	ExpectEq(112, r.lineNumber)
	ExpectThat(r.err, Error(HasSubstr("WillRepeatedly")))
	ExpectThat(r.err, Error(HasSubstr("once")))
}

func (t *InternalExpectationTest) FallbackActionRejectsSignature() {
	exp := t.makeExpectation(float64ReturnSig, []interface{}{}, "taco.go", 112)
	exp.WillRepeatedly(Return("taco"))

	AssertEq(1, len(t.reporter.fatalErrors))
	AssertEq(0, len(t.reporter.errors))

	r := t.reporter.fatalErrors[0]
	ExpectEq("taco.go", r.fileName)
	ExpectEq(112, r.lineNumber)
	ExpectThat(r.err, Error(HasSubstr("arg 0")))
	ExpectThat(r.err, Error(HasSubstr("expected float64")))
	ExpectThat(r.err, Error(HasSubstr("given string")))
}
