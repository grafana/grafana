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

// Package ogletest provides a framework for writing expressive unit tests. It
// integrates with the builtin testing package, so it works with the gotest
// command. Unlike the testing package which offers only basic capabilities for
// signalling failures, it offers ways to express expectations and get nice
// failure messages automatically.
//
// For example:
//
//     ////////////////////////////////////////////////////////////////////////
//     // testing package test
//     ////////////////////////////////////////////////////////////////////////
//
//     someStr, err := ComputeSomeString()
//     if err != nil {
//       t.Errorf("ComputeSomeString: expected nil error, got %v", err)
//     }
//
//     !strings.Contains(someStr, "foo") {
//       t.Errorf("ComputeSomeString: expected substring foo, got %v", someStr)
//     }
//
//     ////////////////////////////////////////////////////////////////////////
//     // ogletest test
//     ////////////////////////////////////////////////////////////////////////
//
//     someStr, err := ComputeSomeString()
//     ExpectEq(nil, err)
//     ExpectThat(someStr, HasSubstr("foo")
//
// Failure messages require no work from the user, and look like the following:
//
//     foo_test.go:103:
//     Expected: has substring "foo"
//     Actual:   "bar baz"
//
package ogletest
