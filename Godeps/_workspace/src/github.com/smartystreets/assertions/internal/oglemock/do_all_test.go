// Copyright 2015 Aaron Jacobs. All Rights Reserved.
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
	"reflect"
	"testing"

	. "github.com/smartystreets/assertions/internal/oglematchers"
	"github.com/smartystreets/assertions/internal/oglemock"
	. "github.com/smartystreets/assertions/internal/ogletest"
)

func TestDoAll(t *testing.T) { RunTests(t) }

////////////////////////////////////////////////////////////
// Boilerplate
////////////////////////////////////////////////////////////

type DoAllTest struct {
}

func init() { RegisterTestSuite(&DoAllTest{}) }

////////////////////////////////////////////////////////////
// Test functions
////////////////////////////////////////////////////////////

func (t *DoAllTest) FirstActionDoesntLikeSignature() {
	f := func(a int, b string) {}

	a0 := oglemock.Invoke(func() {})
	a1 := oglemock.Invoke(f)
	a2 := oglemock.Return()

	err := oglemock.DoAll(a0, a1, a2).SetSignature(reflect.TypeOf(f))
	ExpectThat(err, Error(HasSubstr("Action 0")))
	ExpectThat(err, Error(HasSubstr("func()")))
}

func (t *DoAllTest) LastActionDoesntLikeSignature() {
	f := func(a int, b string) {}

	a0 := oglemock.Invoke(f)
	a1 := oglemock.Invoke(f)
	a2 := oglemock.Return(17)

	err := oglemock.DoAll(a0, a1, a2).SetSignature(reflect.TypeOf(f))
	ExpectThat(err, Error(HasSubstr("Action 2")))
	ExpectThat(err, Error(HasSubstr("1 vals; expected 0")))
}

func (t *DoAllTest) SingleAction() {
	f := func(a int) string { return "" }
	a0 := oglemock.Return("taco")

	action := oglemock.DoAll(a0)
	AssertEq(nil, action.SetSignature(reflect.TypeOf(f)))

	rets := action.Invoke([]interface{}{17})
	ExpectThat(rets, ElementsAre("taco"))
}

func (t *DoAllTest) MultipleActions() {
	f := func(a int) string { return "" }

	var saved int
	a0 := oglemock.SaveArg(0, &saved)
	a1 := oglemock.Return("taco")

	action := oglemock.DoAll(a0, a1)
	AssertEq(nil, action.SetSignature(reflect.TypeOf(f)))

	rets := action.Invoke([]interface{}{17})
	ExpectEq(17, saved)
	ExpectThat(rets, ElementsAre("taco"))
}
