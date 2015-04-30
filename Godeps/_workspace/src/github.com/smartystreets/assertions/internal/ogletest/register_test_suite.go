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

// RegisterTestSuite tells ogletest about a test suite containing tests that it
// should run. Any exported method on the type pointed to by the supplied
// prototype value will be treated as test methods, with the exception of the
// following methods (which need not be present):
//
//  *  SetUpTestSuite() -- called exactly once, before the first test method is
//     run. The receiver of this method will be a zero value of the test suite
//     type, and is not shared with any other methods. Use this method to set
//     up any necessary global state shared by all of the test methods.
//
//  *  TearDownTestSuite() -- called exactly once, after the last test method
//     is run. The receiver of this method will be a zero value of the test
//     suite type, and is not shared with any other methods. Use this method to
//     clean up after any necessary global state shared by all of the test
//     methods.
//
//  *  SetUp(testInfo) -- called before each test method is invoked, with the
//     same receiver as that test method, and with a TestInfo arg. At the time
//     this method is invoked, the receiver is a zero value for the test suite
//     type. Use this method for common setup code that works on data not
//     shared across tests.
//
//  *  TearDown() -- called after each test method is invoked, with the same
//     receiver as that test method. Use this method for common cleanup code
//     that works on data not shared across tests.
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
//     func (t *FooTest) SetUp() {
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

	testSuites = append(testSuites, p)
}

// The set of test suites previously registered.
var testSuites = make([]interface{}, 0)
