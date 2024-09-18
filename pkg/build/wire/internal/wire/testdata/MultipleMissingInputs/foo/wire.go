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

func injectMissingOutputType() Foo {
	// Error: no provider for Foo.
	wire.Build()
	return Foo(0)
}

func injectMultipleMissingTypes() Baz {
	// Error: provideBaz needs Foo and Bar, both missing.
	wire.Build(provideBaz)
	return Baz(0)
}

func injectMissingRecursiveType() Zop {
	// Error:
	// Zop  -> Zap -> Zip -> Foo
	// provideZop needs Zap, provideZap needs Zip, provideZip needs Foo,
	// which is missing.
	wire.Build(provideZop, provideZap, provideZip)
	return Zop(0)
}
