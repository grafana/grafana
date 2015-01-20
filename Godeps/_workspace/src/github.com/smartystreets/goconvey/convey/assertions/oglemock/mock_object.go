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

// MockObject is an interface that mock object implementations must conform to
// in order to register expectations with and hand off calls to a
// MockController. Users should not interact with this interface directly.
type MockObject interface {
	// Oglemock_Id returns an identifier for the mock object that is guaranteed
	// to be unique within the process at least until the mock object is garbage
	// collected.
	Oglemock_Id() uintptr

	// Oglemock_Description returns a description of the mock object that may be
	// helpful in test failure messages.
	Oglemock_Description() string
}
