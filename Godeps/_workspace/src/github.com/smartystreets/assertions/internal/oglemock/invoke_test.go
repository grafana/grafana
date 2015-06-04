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

package oglemock_test

import (
	. "github.com/smartystreets/assertions/internal/oglematchers"
	"github.com/smartystreets/assertions/internal/oglemock"
	. "github.com/smartystreets/assertions/internal/ogletest"
	"reflect"
)

////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////

type InvokeTest struct {
}

func init() { RegisterTestSuite(&InvokeTest{}) }

////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////

func (t *InvokeTest) ArgumentIsNil() {
	f := func() { oglemock.Invoke(nil) }
	ExpectThat(f, Panics(MatchesRegexp("Invoke.*function.*<nil>")))
}

func (t *InvokeTest) ArgumentIsInt() {
	f := func() { oglemock.Invoke(17) }
	ExpectThat(f, Panics(MatchesRegexp("Invoke.*function.*int")))
}

func (t *InvokeTest) FunctionHasOneWrongInputType() {
	f := func(a int, b int32, c string) {}
	g := func(a int, b int, c string) {}

	err := oglemock.Invoke(f).SetSignature(reflect.TypeOf(g))
	ExpectThat(err, Error(HasSubstr("func(int, int32, string)")))
	ExpectThat(err, Error(HasSubstr("func(int, int, string)")))
}

func (t *InvokeTest) FunctionHasOneWrongOutputType() {
	f := func() (int32, string) { return 0, "" }
	g := func() (int, string) { return 0, "" }

	err := oglemock.Invoke(f).SetSignature(reflect.TypeOf(g))
	ExpectThat(err, Error(HasSubstr("func() (int32, string)")))
	ExpectThat(err, Error(HasSubstr("func() (int, string)")))
}

func (t *InvokeTest) CallsFunction() {
	var actualArg0, actualArg1 interface{}

	f := func(a uintptr, b int8) {
		actualArg0 = a
		actualArg1 = b
	}

	a := oglemock.Invoke(f)

	// Set signature.
	AssertEq(nil, a.SetSignature(reflect.TypeOf(f)))

	// Call the action.
	expectedArg0 := uintptr(17)
	expectedArg1 := int8(-7)

	a.Invoke([]interface{}{expectedArg0, expectedArg1})

	ExpectThat(actualArg0, IdenticalTo(expectedArg0))
	ExpectThat(actualArg1, IdenticalTo(expectedArg1))
}

func (t *InvokeTest) ReturnsFunctionResult() {
	expectedReturn0 := int16(3)
	expectedReturn1 := "taco"

	f := func() (int16, string) {
		return expectedReturn0, expectedReturn1
	}

	a := oglemock.Invoke(f)

	// Set signature.
	AssertEq(nil, a.SetSignature(reflect.TypeOf(f)))

	// Call the action.
	res := a.Invoke([]interface{}{})

	ExpectThat(
		res,
		ElementsAre(
			IdenticalTo(expectedReturn0),
			IdenticalTo(expectedReturn1)))
}
