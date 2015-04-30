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
	"image/color"
	"testing"

	. "github.com/smartystreets/assertions/internal/oglematchers"
	"github.com/smartystreets/assertions/internal/oglemock"
	. "github.com/smartystreets/assertions/internal/ogletest"
	"github.com/smartystreets/assertions/internal/ogletest/test_cases/mock_image"
)

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

type MockTest struct {
	controller oglemock.Controller
	image      mock_image.MockImage
}

func init()                     { RegisterTestSuite(&MockTest{}) }
func TestMockTest(t *testing.T) { RunTests(t) }

func (t *MockTest) SetUp(i *TestInfo) {
	t.controller = i.MockController
	t.image = mock_image.NewMockImage(t.controller, "some mock image")
}

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func (t *MockTest) ExpectationSatisfied() {
	ExpectCall(t.image, "At")(11, GreaterThan(19)).
		WillOnce(oglemock.Return(color.Gray{0}))

	ExpectThat(t.image.At(11, 23), IdenticalTo(color.Gray{0}))
}

func (t *MockTest) MockExpectationNotSatisfied() {
	ExpectCall(t.image, "At")(11, GreaterThan(19)).
		WillOnce(oglemock.Return(color.Gray{0}))
}

func (t *MockTest) ExpectCallForUnknownMethod() {
	ExpectCall(t.image, "FooBar")(11)
}

func (t *MockTest) UnexpectedCall() {
	t.image.At(11, 23)
}

func (t *MockTest) InvokeFunction() {
	var suppliedX, suppliedY int
	f := func(x, y int) color.Color {
		suppliedX = x
		suppliedY = y
		return color.Gray{17}
	}

	ExpectCall(t.image, "At")(Any(), Any()).
		WillOnce(oglemock.Invoke(f))

	ExpectThat(t.image.At(-1, 12), IdenticalTo(color.Gray{17}))
	ExpectEq(-1, suppliedX)
	ExpectEq(12, suppliedY)
}
