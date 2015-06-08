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
	"fmt"
	"reflect"

	"github.com/smartystreets/assertions/internal/ogletest/srcutil"
)

// Test suites that implement this interface have special meaning to
// RegisterTestSuite.
type SetUpTestSuiteInterface interface {
	// This method will be called exactly once, before the first test method is
	// run. The receiver of this method will be a zero value of the test suite
	// type, and is not shared with any other methods. Use this method to set up
	// any necessary global state shared by all of the test methods.
	SetUpTestSuite()
}

// Test suites that implement this interface have special meaning to
// RegisterTestSuite.
type TearDownTestSuiteInterface interface {
	// This method will be called exactly once, after the last test method is
	// run. The receiver of this method will be a zero value of the test suite
	// type, and is not shared with any other methods. Use this method to clean
	// up after any necessary global state shared by all of the test methods.
	TearDownTestSuite()
}

// Test suites that implement this interface have special meaning to
// Register.
type SetUpInterface interface {
	// This method is called before each test method is invoked, with the same
	// receiver as that test method. At the time this method is invoked, the
	// receiver is a zero value for the test suite type. Use this method for
	// common setup code that works on data not shared across tests.
	SetUp(*TestInfo)
}

// Test suites that implement this interface have special meaning to
// Register.
type TearDownInterface interface {
	// This method is called after each test method is invoked, with the same
	// receiver as that test method. Use this method for common cleanup code that
	// works on data not shared across tests.
	TearDown()
}

// RegisterTestSuite tells ogletest about a test suite containing tests that it
// should run. Any exported method on the type pointed to by the supplied
// prototype value will be treated as test methods, with the exception of the
// methods defined by the following interfaces, which when present are treated
// as described in the documentation for those interfaces:
//
//  *  SetUpTestSuiteInterface
//  *  SetUpInterface
//  *  TearDownInterface
//  *  TearDownTestSuiteInterface
//
// Each test method is invoked on a different receiver, which is initially a
// zero value of the test suite type.
//
// Example:
//
//     // Some value that is needed by the tests but is expensive to compute.
//     var someExpensiveThing uint
//
//     type FooTest struct {
//       // Path to a temporary file used by the tests. Each test gets a
//       // different temporary file.
//       tempFile string
//     }
//     func init() { ogletest.RegisterTestSuite(&FooTest{}) }
//
//     func (t *FooTest) SetUpTestSuite() {
//       someExpensiveThing = ComputeSomeExpensiveThing()
//     }
//
//     func (t *FooTest) SetUp(ti *ogletest.TestInfo) {
//       t.tempFile = CreateTempFile()
//     }
//
//     func (t *FooTest) TearDown() {
//       DeleteTempFile(t.tempFile)
//     }
//
//     func (t *FooTest) FrobinicatorIsSuccessfullyTweaked() {
//       res := DoSomethingWithExpensiveThing(someExpensiveThing, t.tempFile)
//       ExpectThat(res, Equals(true))
//     }
//
func RegisterTestSuite(p interface{}) {
	if p == nil {
		panic("RegisterTestSuite called with nil suite.")
	}

	val := reflect.ValueOf(p)
	typ := val.Type()
	var zeroInstance reflect.Value

	// We will transform to a TestSuite struct.
	suite := TestSuite{}
	suite.Name = typ.Elem().Name()

	zeroInstance = reflect.New(typ.Elem())
	if i, ok := zeroInstance.Interface().(SetUpTestSuiteInterface); ok {
		suite.SetUp = func() { i.SetUpTestSuite() }
	}

	zeroInstance = reflect.New(typ.Elem())
	if i, ok := zeroInstance.Interface().(TearDownTestSuiteInterface); ok {
		suite.TearDown = func() { i.TearDownTestSuite() }
	}

	// Transform a list of test methods for the suite, filtering them to just the
	// ones that we don't need to skip.
	for _, method := range filterMethods(suite.Name, srcutil.GetMethodsInSourceOrder(typ)) {
		var tf TestFunction
		tf.Name = method.Name

		// Create an instance to be operated on by all of the TestFunction's
		// internal functions.
		instance := reflect.New(typ.Elem())

		// Bind the functions to the instance.
		if i, ok := instance.Interface().(SetUpInterface); ok {
			tf.SetUp = func(ti *TestInfo) { i.SetUp(ti) }
		}

		methodCopy := method
		tf.Run = func() { runTestMethod(instance, methodCopy) }

		if i, ok := instance.Interface().(TearDownInterface); ok {
			tf.TearDown = func() { i.TearDown() }
		}

		// Save the TestFunction.
		suite.TestFunctions = append(suite.TestFunctions, tf)
	}

	// Register the suite.
	Register(suite)
}

func runTestMethod(suite reflect.Value, method reflect.Method) {
	if method.Func.Type().NumIn() != 1 {
		panic(fmt.Sprintf(
			"%s: expected 1 args, actually %d.",
			method.Name,
			method.Func.Type().NumIn()))
	}

	method.Func.Call([]reflect.Value{suite})
}

func filterMethods(suiteName string, in []reflect.Method) (out []reflect.Method) {
	for _, m := range in {
		// Skip set up, tear down, and unexported methods.
		if isSpecialMethod(m.Name) || !isExportedMethod(m.Name) {
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
