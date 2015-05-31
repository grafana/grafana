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
	"io"
	"os"
	"reflect"
	"testing"

	. "github.com/smartystreets/assertions/internal/oglematchers"
	"github.com/smartystreets/assertions/internal/oglemock"
	. "github.com/smartystreets/assertions/internal/ogletest"
)

func TestSaveArg(t *testing.T) { RunTests(t) }

////////////////////////////////////////////////////////////
// Boilerplate
////////////////////////////////////////////////////////////

type SaveArgTest struct {
}

func init() { RegisterTestSuite(&SaveArgTest{}) }

////////////////////////////////////////////////////////////
// Test functions
////////////////////////////////////////////////////////////

func (t *SaveArgTest) FunctionHasNoArguments() {
	const index = 0
	var dst int
	f := func() (int, string) { return 0, "" }

	err := oglemock.SaveArg(index, &dst).SetSignature(reflect.TypeOf(f))
	ExpectThat(err, Error(HasSubstr("index 0")))
	ExpectThat(err, Error(HasSubstr("Out of range")))
	ExpectThat(err, Error(HasSubstr("func() (int, string)")))
}

func (t *SaveArgTest) ArgumentIndexOutOfRange() {
	const index = 2
	var dst int
	f := func(a int, b int) {}

	err := oglemock.SaveArg(index, &dst).SetSignature(reflect.TypeOf(f))
	ExpectThat(err, Error(HasSubstr("index 2")))
	ExpectThat(err, Error(HasSubstr("Out of range")))
	ExpectThat(err, Error(HasSubstr("func(int, int)")))
}

func (t *SaveArgTest) DestinationIsLiteralNil() {
	const index = 0
	f := func(a int, b int) {}

	err := oglemock.SaveArg(index, nil).SetSignature(reflect.TypeOf(f))
	ExpectThat(err, Error(HasSubstr("not a pointer")))
}

func (t *SaveArgTest) DestinationIsNotAPointer() {
	const index = 0
	f := func(a int, b int) {}

	err := oglemock.SaveArg(index, uint(17)).SetSignature(reflect.TypeOf(f))
	ExpectThat(err, Error(HasSubstr("pointer")))
	ExpectThat(err, Error(HasSubstr("uint")))
}

func (t *SaveArgTest) DestinationIsNilPointer() {
	const index = 1
	var dst *int
	f := func(a int, b int) {}

	err := oglemock.SaveArg(index, dst).SetSignature(reflect.TypeOf(f))
	ExpectThat(err, Error(HasSubstr("pointer")))
	ExpectThat(err, Error(HasSubstr("non-nil")))
}

func (t *SaveArgTest) DestinationNotAssignableFromSource() {
	const index = 1
	var dst int
	f := func(a int, b string) {}

	err := oglemock.SaveArg(index, &dst).SetSignature(reflect.TypeOf(f))
	ExpectThat(err, Error(HasSubstr("int")))
	ExpectThat(err, Error(HasSubstr("assignable")))
	ExpectThat(err, Error(HasSubstr("string")))
}

func (t *SaveArgTest) ExactTypeMatch() {
	const index = 1
	var dst int
	f := func(a int, b int) {}

	action := oglemock.SaveArg(index, &dst)
	AssertEq(nil, action.SetSignature(reflect.TypeOf(f)))

	var a int = 17
	var b int = 19
	_ = action.Invoke([]interface{}{a, b})

	ExpectEq(19, dst)
}

func (t *SaveArgTest) AssignableTypeMatch() {
	const index = 1
	var dst io.Reader
	f := func(a int, b *os.File) {}

	action := oglemock.SaveArg(index, &dst)
	AssertEq(nil, action.SetSignature(reflect.TypeOf(f)))

	var a int = 17
	var b *os.File = os.Stdout
	_ = action.Invoke([]interface{}{a, b})

	ExpectEq(os.Stdout, dst)
}
