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

package ogletest

// The input to ogletest.Register. Most users will want to use
// ogletest.RegisterTestSuite.
//
// A test suite is the basic unit of registration in ogletest. It consists of
// zero or more named test functions which will be run in sequence, along with
// optional setup and tear-down functions.
type TestSuite struct {
	// The name of the overall suite, e.g. "MyPackageTest".
	Name string

	// If non-nil, a function that will be run exactly once, before any of the
	// test functions are run.
	SetUp func()

	// The test functions comprising this suite.
	TestFunctions []TestFunction

	// If non-nil, a function that will be run exactly once, after all of the
	// test functions have run.
	TearDown func()
}

type TestFunction struct {
	// The name of this test function, relative to the suite in which it resides.
	// If the name is "TweaksFrobnicator", then the function might be presented
	// in the ogletest UI as "FooTest.TweaksFrobnicator".
	Name string

	// If non-nil, a function that is run before Run, passed a pointer to a
	// struct containing information about the test run.
	SetUp func(*TestInfo)

	// The function to invoke for the test body. Must be non-nil. Will not be run
	// if SetUp panics.
	Run func()

	// If non-nil, a function that is run after Run.
	TearDown func()
}

// Register a test suite for execution by RunTests.
//
// This is the most general registration mechanism. Most users will want
// RegisterTestSuite, which is a wrapper around this function that requires
// less boilerplate.
//
// Panics on invalid input.
func Register(suite TestSuite) {
	// Make sure the suite is legal.
	if suite.Name == "" {
		panic("Test suites must have names.")
	}

	for _, tf := range suite.TestFunctions {
		if tf.Name == "" {
			panic("Test functions must have names.")
		}

		if tf.Run == nil {
			panic("Test functions must have non-nil run fields.")
		}
	}

	// Save the suite for later.
	registeredSuites = append(registeredSuites, suite)
}

// The list of test suites previously registered.
var registeredSuites []TestSuite
