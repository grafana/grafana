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

package oglematchers_test

import (
	"fmt"
	"testing"

	. "github.com/smartystreets/assertions/internal/oglematchers"
	. "github.com/smartystreets/assertions/internal/ogletest"
)

func TestFailingTest(t *testing.T) { RunTests(t) }

////////////////////////////////////////////////////////////////////////
// Usual failures
////////////////////////////////////////////////////////////////////////

type FailingTest struct {
}

func init() { RegisterTestSuite(&FailingTest{}) }

func (t *FailingTest) TearDown() {
	fmt.Println("TearDown running.")
}

func (t *FailingTest) PassingMethod() {
}

func (t *FailingTest) Equals() {
	ExpectThat(17, Equals(17.5))
	ExpectThat(17, Equals("taco"))
}

func (t *FailingTest) LessThan() {
	ExpectThat(18, LessThan(17))
	ExpectThat(18, LessThan("taco"))
}

func (t *FailingTest) HasSubstr() {
	ExpectThat("taco", HasSubstr("ac"))
	ExpectThat(17, HasSubstr("ac"))
}

func (t *FailingTest) ExpectWithUserErrorMessages() {
	ExpectThat(17, Equals(19), "foo bar: %d", 112)
	ExpectEq(17, 17.5, "foo bar: %d", 112)
	ExpectLe(17, 16.9, "foo bar: %d", 112)
	ExpectLt(17, 16.9, "foo bar: %d", 112)
	ExpectGe(17, 17.1, "foo bar: %d", 112)
	ExpectGt(17, "taco", "foo bar: %d", 112)
	ExpectNe(17, 17.0, "foo bar: %d", 112)
	ExpectFalse(true, "foo bar: %d", 112)
	ExpectTrue(false, "foo bar: %d", 112)
}

func (t *FailingTest) AssertWithUserErrorMessages() {
	AssertThat(17, Equals(19), "foo bar: %d", 112)
}

func (t *FailingTest) ModifiedExpectation() {
	ExpectThat(17, HasSubstr("ac")).SetCaller("foo.go", 112)
	ExpectEq(17, 19).SetCaller("bar.go", 117)
}

func (t *FailingTest) ExpectationAliases() {
	ExpectEq(17, 17.5)
	ExpectEq("taco", 17.5)

	ExpectLe(17, 16.9)
	ExpectLt(17, 16.9)
	ExpectLt(17, "taco")

	ExpectGe(17, 17.1)
	ExpectGt(17, 17.1)
	ExpectGt(17, "taco")

	ExpectNe(17, 17.0)
	ExpectNe(17, "taco")

	ExpectFalse(true)
	ExpectFalse("taco")

	ExpectTrue(false)
	ExpectTrue("taco")
}

func (t *FailingTest) AssertThatFailure() {
	AssertThat(17, Equals(19))
	panic("Shouldn't get here.")
}

func (t *FailingTest) AssertEqFailure() {
	AssertEq(19, 17)
	panic("Shouldn't get here.")
}

func (t *FailingTest) AssertNeFailure() {
	AssertNe(19, 19)
	panic("Shouldn't get here.")
}

func (t *FailingTest) AssertLeFailure() {
	AssertLe(19, 17)
	panic("Shouldn't get here.")
}

func (t *FailingTest) AssertLtFailure() {
	AssertLt(19, 17)
	panic("Shouldn't get here.")
}

func (t *FailingTest) AssertGeFailure() {
	AssertGe(17, 19)
	panic("Shouldn't get here.")
}

func (t *FailingTest) AssertGtFailure() {
	AssertGt(17, 19)
	panic("Shouldn't get here.")
}

func (t *FailingTest) AssertTrueFailure() {
	AssertTrue("taco")
	panic("Shouldn't get here.")
}

func (t *FailingTest) AssertFalseFailure() {
	AssertFalse("taco")
	panic("Shouldn't get here.")
}

////////////////////////////////////////////////////////////////////////
// Expectation failure during SetUp
////////////////////////////////////////////////////////////////////////

type ExpectFailDuringSetUpTest struct {
}

func init() { RegisterTestSuite(&ExpectFailDuringSetUpTest{}) }

func (t *ExpectFailDuringSetUpTest) SetUp(i *TestInfo) {
	ExpectFalse(true)
}

func (t *ExpectFailDuringSetUpTest) TearDown() {
	fmt.Println("TearDown running.")
}

func (t *ExpectFailDuringSetUpTest) PassingMethod() {
	fmt.Println("Method running.")
}

////////////////////////////////////////////////////////////////////////
// Assertion failure during SetUp
////////////////////////////////////////////////////////////////////////

type AssertFailDuringSetUpTest struct {
}

func init() { RegisterTestSuite(&AssertFailDuringSetUpTest{}) }

func (t *AssertFailDuringSetUpTest) SetUp(i *TestInfo) {
	AssertFalse(true)
}

func (t *AssertFailDuringSetUpTest) TearDown() {
	fmt.Println("TearDown running.")
}

func (t *AssertFailDuringSetUpTest) PassingMethod() {
	fmt.Println("Method running.")
}

////////////////////////////////////////////////////////////////////////
// Expectation failure during TearDown
////////////////////////////////////////////////////////////////////////

type ExpectFailDuringTearDownTest struct {
}

func init() { RegisterTestSuite(&ExpectFailDuringTearDownTest{}) }

func (t *ExpectFailDuringTearDownTest) SetUp(i *TestInfo) {
	fmt.Println("SetUp running.")
}

func (t *ExpectFailDuringTearDownTest) TearDown() {
	ExpectFalse(true)
}

func (t *ExpectFailDuringTearDownTest) PassingMethod() {
	fmt.Println("Method running.")
}

////////////////////////////////////////////////////////////////////////
// Assertion failure during TearDown
////////////////////////////////////////////////////////////////////////

type AssertFailDuringTearDownTest struct {
}

func init() { RegisterTestSuite(&AssertFailDuringTearDownTest{}) }

func (t *AssertFailDuringTearDownTest) SetUp(i *TestInfo) {
	fmt.Println("SetUp running.")
}

func (t *AssertFailDuringTearDownTest) TearDown() {
	AssertFalse(true)
}

func (t *AssertFailDuringTearDownTest) PassingMethod() {
	fmt.Println("Method running.")
}
