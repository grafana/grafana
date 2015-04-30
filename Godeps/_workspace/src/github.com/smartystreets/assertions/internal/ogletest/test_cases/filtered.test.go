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
	"fmt"
	"testing"

	. "github.com/smartystreets/assertions/internal/oglematchers"
	. "github.com/smartystreets/assertions/internal/ogletest"
)

func TestFiltered(t *testing.T) { RunTests(t) }

////////////////////////////////////////////////////////////////////////
// Partially filtered out
////////////////////////////////////////////////////////////////////////

type PartiallyFilteredTest struct {
}

func init() { RegisterTestSuite(&PartiallyFilteredTest{}) }

func (t *PartiallyFilteredTest) PassingTestFoo() {
	ExpectThat(19, Equals(19))
}

func (t *PartiallyFilteredTest) PassingTestBar() {
	ExpectThat(17, Equals(17))
}

func (t *PartiallyFilteredTest) PartiallyFilteredTestFoo() {
	ExpectThat(18, LessThan(17))
}

func (t *PartiallyFilteredTest) PartiallyFilteredTestBar() {
	ExpectThat("taco", HasSubstr("blah"))
}

func (t *PartiallyFilteredTest) PartiallyFilteredTestBaz() {
	ExpectThat(18, LessThan(17))
}

////////////////////////////////////////////////////////////////////////
// Completely filtered out
////////////////////////////////////////////////////////////////////////

type CompletelyFilteredTest struct {
}

func init() { RegisterTestSuite(&CompletelyFilteredTest{}) }

func (t *CompletelyFilteredTest) SetUpTestSuite() {
	fmt.Println("SetUpTestSuite run!")
}

func (t *CompletelyFilteredTest) TearDownTestSuite() {
	fmt.Println("TearDownTestSuite run!")
}

func (t *PartiallyFilteredTest) SomePassingTest() {
	ExpectThat(19, Equals(19))
}

func (t *PartiallyFilteredTest) SomeFailingTest() {
	ExpectThat(19, Equals(17))
}
