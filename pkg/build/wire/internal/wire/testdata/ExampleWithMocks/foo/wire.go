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

//go:build wireinject
// +build wireinject

package main

import (
	"github.com/grafana/grafana/pkg/build/wire"
)

// initApp returns a real app.
func initApp() *app {
	wire.Build(appSet)
	return nil
}

// initMockedAppFromArgs returns an app with mocked dependencies provided via
// arguments (Approach A). Note that the argument's type is the interface
// type (timer), but the concrete mock type should be passed.
func initMockedAppFromArgs(mt timer) *app {
	wire.Build(appSetWithoutMocks)
	return nil
}

// initMockedApp returns an app with its mocked dependencies, created
// via providers (Approach B).
func initMockedApp() *appWithMocks {
	wire.Build(mockAppSet)
	return nil
}
