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
	"sync"

	"github.com/grafana/grafana/pkg/build/wire"
)

func main() {
	fb := injectFooBar()
	pfb := injectPartFooBar()
	fmt.Println(fb.Foo, fb.Bar)
	fmt.Println(pfb.Foo, pfb.Bar)
}

type Foo int
type Bar int

type FooBar struct {
	mu  sync.Mutex `wire:"-"`
	Foo Foo
	Bar Bar
}

func provideFoo() Foo {
	return 41
}

func provideBar() Bar {
	return 1
}

var Set = wire.NewSet(
	wire.Struct(new(FooBar), "*"),
	provideFoo,
	provideBar)

var PartSet = wire.NewSet(
	wire.Struct(new(FooBar), "Foo"),
	provideFoo,
)
