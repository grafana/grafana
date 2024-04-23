// Copyright 2018 The Wire Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This test demonstrates how to use mocks with wire.

package main

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/build/wire"
)

func main() {
	// Create a "real" greeter.
	// Greet() will include the real current time, so elide it for repeatable
	// tests.
	fmt.Printf("Real time greeting: %s [current time elided]\n", initApp().Greet()[0:15])

	// There are two approaches for creating an app with mocks.

	// Approach A: create the mocks manually, and pass them to an injector.
	// This approach is useful if you need to prime the mocks beforehand.
	fmt.Println("Approach A")
	mt := newMockTimer()
	mockedApp := initMockedAppFromArgs(mt)
	fmt.Println(mockedApp.Greet()) // prints greeting with time = zero time
	mt.T = mt.T.AddDate(1999, 0, 0)
	fmt.Println(mockedApp.Greet()) // prints greeting with time = year 2000

	// Approach B: allow the injector to create the mocks, and return a struct
	// that includes the resulting app plus the mocks.
	fmt.Println("Approach B")
	appWithMocks := initMockedApp()
	fmt.Println(appWithMocks.app.Greet()) // prints greeting with time = zero time
	appWithMocks.mt.T = appWithMocks.mt.T.AddDate(999, 0, 0)
	fmt.Println(appWithMocks.app.Greet()) // prints greeting with time = year 1000
}

// appSet is a provider set for creating a real app.
var appSet = wire.NewSet(
	wire.Struct(new(app), "*"),
	wire.Struct(new(greeter), "*"),
	wire.InterfaceValue(new(timer), realTime{}),
)

// appSetWithoutMocks is a provider set for creating an app with mocked
// dependencies. The mocked dependencies are omitted and must be provided as
// arguments to the injector.
// It is used for Approach A.
var appSetWithoutMocks = wire.NewSet(
	wire.Struct(new(app), "*"),
	wire.Struct(new(greeter), "*"),
)

// mockAppSet is a provider set for creating a mocked app, including the mocked
// dependencies.
// It is used for Approach B.
var mockAppSet = wire.NewSet(
	wire.Struct(new(app), "*"),
	wire.Struct(new(greeter), "*"),
	wire.Struct(new(appWithMocks), "*"),
	// For each mocked dependency, add a provider and use wire.Bind to bind
	// the concrete type to the relevant interface.
	newMockTimer,
	wire.Bind(new(timer), new(*mockTimer)),
)

type timer interface {
	Now() time.Time
}

// realTime implements timer with the real time.
type realTime struct{}

func (realTime) Now() time.Time { return time.Now() }

// mockTimer implements timer using a mocked time.
type mockTimer struct {
	T time.Time
}

func newMockTimer() *mockTimer      { return &mockTimer{} }
func (m *mockTimer) Now() time.Time { return m.T }

// greeter issues greetings with the time provided by T.
type greeter struct {
	T timer
}

func (g greeter) Greet() string {
	return fmt.Sprintf("Good day! It is %v", g.T.Now())
}

type app struct {
	g greeter
}

func (a app) Greet() string {
	return a.g.Greet()
}

// appWithMocks is used for Approach B, to return the app plus its mocked
// dependencies.
type appWithMocks struct {
	app app
	mt  *mockTimer
}
