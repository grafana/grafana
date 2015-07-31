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

package oglemock

// Expectation is an expectation for zero or more calls to a mock method with
// particular arguments or sets of arguments.
type Expectation interface {
	// Times expresses that a matching method call should happen exactly N times.
	// Times must not be called more than once, and must not be called after
	// WillOnce or WillRepeatedly.
	//
	// The full rules for the cardinality of an expectation are as follows:
	//
	//  1. If an explicit cardinality is set with Times(N), then anything other
	//     than exactly N matching calls will cause a test failure.
	//
	//  2. Otherwise, if there are any one-time actions set up, then it is
	//     expected there will be at least that many matching calls. If there is
	//     not also a fallback action, then it is expected that there will be
	//     exactly that many.
	//
	//  3. Otherwise, if there is a fallback action configured, any number of
	//     matching calls (including zero) is allowed.
	//
	//  4. Otherwise, the implicit cardinality is one.
	//
	Times(n uint) Expectation

	// WillOnce configures a "one-time action". WillOnce can be called zero or
	// more times, but must be called after any call to Times and before any call
	// to WillRepeatedly.
	//
	// When matching method calls are made on the mock object, one-time actions
	// are invoked one per matching call in the order that they were set up until
	// they are exhausted. Afterward the fallback action, if any, will be used.
	WillOnce(a Action) Expectation

	// WillRepeatedly configures a "fallback action". WillRepeatedly can be
	// called zero or one times, and must not be called before Times or WillOnce.
	//
	// Once all one-time actions are exhausted (see above), the fallback action
	// will be invoked for any further method calls. If WillRepeatedly is not
	// called, the fallback action is implicitly an action that returns zero
	// values for the method's return values.
	WillRepeatedly(a Action) Expectation
}
