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

package oglematchers_test

import (
	. "github.com/smartystreets/goconvey/convey/assertions/oglematchers"
	. "github.com/smartystreets/goconvey/convey/assertions/ogletest"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type AnyTest struct {
}

func init() { RegisterTestSuite(&AnyTest{}) }

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *AnyTest) Description() {
	m := Any()
	ExpectEq("is anything", m.Description())
}

func (t *AnyTest) Matches() {
	var err error
	m := Any()

	err = m.Matches(nil)
	ExpectEq(nil, err)

	err = m.Matches(17)
	ExpectEq(nil, err)

	err = m.Matches("taco")
	ExpectEq(nil, err)
}
