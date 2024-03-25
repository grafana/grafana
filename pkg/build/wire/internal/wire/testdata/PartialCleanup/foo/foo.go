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
	"errors"
	"fmt"
	"strings"
)

var (
	cleanedFoo = false
	cleanedBar = false
)

func main() {
	_, cleanup, err := injectBaz()
	if err == nil {
		fmt.Println("<nil>")
	} else {
		fmt.Println(strings.Contains(err.Error(), "bork!"))
	}
	fmt.Println(cleanedFoo, cleanedBar, cleanup == nil)
}

type Foo int
type Bar int
type Baz int

func provideFoo() (*Foo, func()) {
	foo := new(Foo)
	*foo = 42
	return foo, func() { *foo = 0; cleanedFoo = true }
}

func provideBar(foo *Foo) (*Bar, func(), error) {
	bar := new(Bar)
	*bar = 77
	return bar, func() {
		if *foo == 0 {
			panic("foo cleaned up before bar")
		}
		*bar = 0
		cleanedBar = true
	}, nil
}

func provideBaz(bar *Bar) (Baz, error) {
	return 0, errors.New("bork!")
}
