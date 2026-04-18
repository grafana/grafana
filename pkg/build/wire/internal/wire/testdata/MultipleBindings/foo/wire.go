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
	"strings"

	"github.com/grafana/grafana/pkg/build/wire"
)

func inject() Foo {
	// fail: provideFoo and provideFooAgain both provide Foo.
	panic(wire.Build(provideFoo, provideFooAgain))
}

func injectFromSet() Foo {
	// fail: provideFoo is also provided by Set.
	panic(wire.Build(provideFoo, Set))
}

func injectFromNestedSet() Foo {
	// fail: provideFoo is also provided by SuperSet, via Set.
	panic(wire.Build(provideFoo, SuperSet))
}

func injectFromSetWithDuplicateBindings() Foo {
	// fail: DuplicateBindingsSet has two providers for Foo.
	panic(wire.Build(SetWithDuplicateBindings))
}

func injectDuplicateValues() Foo {
	// fail: provideFoo and wire.Value both provide Foo.
	panic(wire.Build(provideFoo, wire.Value(Foo("foo"))))
}

func injectDuplicateInterface() Bar {
	// fail: provideBar and wire.Bind both provide Bar.
	panic(wire.Build(provideBar, wire.Bind(new(Bar), new(*strings.Reader))))
}
