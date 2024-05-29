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

package main

import (
	"fmt"

	"github.com/grafana/grafana/pkg/build/wire"
)

func main() {
	fmt.Println(injectFooBar())
}

type Foo int
type Bar int
type Unused int
type UnusedInSet int
type OneOfTwo int
type TwoOfTwo int

type FooBar struct {
	MyFoo    *Foo
	MyBar    Bar
	MyUnused Unused
}

var (
	unusedSet        = wire.NewSet(provideUnusedInSet)
	partiallyUsedSet = wire.NewSet(provideOneOfTwo, provideTwoOfTwo)
)

type Fooer interface {
	Foo() string
}

func (f *Foo) Foo() string {
	return fmt.Sprintf("Hello World %d", f)
}

func provideFoo() *Foo {
	f := new(Foo)
	*f = 1
	return f
}

func provideBar(foo *Foo, one OneOfTwo) Bar {
	return Bar(int(*foo) + int(one))
}

func provideUnused() Unused {
	return 1
}

func provideUnusedInSet() UnusedInSet {
	return 1
}

func provideOneOfTwo() OneOfTwo {
	return 1
}

func provideTwoOfTwo() TwoOfTwo {
	return 1
}

type S struct {
	Cfg Config
}

type Config int
