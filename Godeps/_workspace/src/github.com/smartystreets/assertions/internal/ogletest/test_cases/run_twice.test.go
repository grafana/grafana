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
	. "github.com/smartystreets/assertions/internal/oglematchers"
	. "github.com/smartystreets/assertions/internal/ogletest"
	"testing"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type RunTwiceTest struct {
}

func init() { RegisterTestSuite(&RunTwiceTest{}) }

// Set up two helpers that call RunTests. The test should still only be run
// once.
func TestOgletest(t *testing.T)  { RunTests(t) }
func TestOgletest2(t *testing.T) { RunTests(t) }

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *RunTwiceTest) PassingMethod() {
}

func (t *RunTwiceTest) FailingMethod() {
	ExpectThat(17, Equals(17.5))
}
