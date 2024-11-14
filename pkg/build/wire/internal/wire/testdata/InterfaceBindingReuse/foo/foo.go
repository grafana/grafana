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

// This test verifies that the concrete type is provided only once, even if an
// interface additionally depends on it.

package main

import (
	"fmt"
	"sync"
)

func main() {
	injectFooBar()
	fmt.Println(provideBarCalls)
}

type Fooer interface {
	Foo() string
}

type Bar string

type FooBar struct {
	Fooer Fooer
	Bar   *Bar
}

func (b *Bar) Foo() string {
	return string(*b)
}

func provideBar() *Bar {
	mu.Lock()
	provideBarCalls++
	mu.Unlock()
	b := new(Bar)
	*b = "Hello, World!"
	return b
}

var (
	mu              sync.Mutex
	provideBarCalls int
)

func provideFooBar(fooer Fooer, bar *Bar) FooBar {
	return FooBar{fooer, bar}
}
