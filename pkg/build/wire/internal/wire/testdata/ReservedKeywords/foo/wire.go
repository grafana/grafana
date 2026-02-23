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

// Wire tries to disambiguate the variable "select" by prepending
// the package name; this package-scoped variable conflicts with that
// and forces a different name.
var mainSelect = 0

func injectInterface() Interface {
	// interface and select are Go reserved words, so
	// Wire should avoid using them as variable names.
	panic(wire.Build(provideInterface, provideSelect))
}
