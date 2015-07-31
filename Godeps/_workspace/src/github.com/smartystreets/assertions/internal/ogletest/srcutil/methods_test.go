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

package srcutil_test

import (
	"fmt"
	"reflect"
	"testing"

	. "github.com/smartystreets/assertions/internal/oglematchers"
	. "github.com/smartystreets/assertions/internal/ogletest"
	"github.com/smartystreets/assertions/internal/ogletest/srcutil"
)

func TestRegisterMethodsTest(t *testing.T) { RunTests(t) }

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type MethodsTest struct {
}

func init() { RegisterTestSuite(&MethodsTest{}) }

type OneMethodType int

func (x OneMethodType) Foo() {}

type MultipleMethodsType int

func (x MultipleMethodsType) Foo() {}
func (x MultipleMethodsType) Bar() {}
func (x MultipleMethodsType) Baz() {}

type methodNameMatcher struct {
	expected string
}

func (m *methodNameMatcher) Description() string {
	return fmt.Sprintf("method named %s", m.expected)
}

func (m *methodNameMatcher) Matches(x interface{}) error {
	method, ok := x.(reflect.Method)
	if !ok {
		panic("Invalid argument.")
	}

	if method.Name != m.expected {
		return fmt.Errorf("whose name is %s", method.Name)
	}

	return nil
}

func NameIs(name string) Matcher {
	return &methodNameMatcher{name}
}

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *MethodsTest) NoMethods() {
	type foo int

	methods := srcutil.GetMethodsInSourceOrder(reflect.TypeOf(foo(17)))
	ExpectThat(methods, ElementsAre())
}

func (t *MethodsTest) OneMethod() {
	methods := srcutil.GetMethodsInSourceOrder(reflect.TypeOf(OneMethodType(17)))
	ExpectThat(
		methods,
		ElementsAre(
			NameIs("Foo"),
		))
}

func (t *MethodsTest) MultipleMethods() {
	methods := srcutil.GetMethodsInSourceOrder(reflect.TypeOf(MultipleMethodsType(17)))
	ExpectThat(
		methods,
		ElementsAre(
			NameIs("Foo"),
			NameIs("Bar"),
			NameIs("Baz"),
		))

	ExpectEq("Foo", methods[0].Name)
	ExpectEq("Bar", methods[1].Name)
	ExpectEq("Baz", methods[2].Name)
}
