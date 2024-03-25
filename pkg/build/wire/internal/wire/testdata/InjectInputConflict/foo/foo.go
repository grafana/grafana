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
	// I'm on the fence as to whether this should be an error (versus an
	// override). For now, I will make it an error that can be relaxed
	// later.
	fmt.Println(injectBar(40))
}

type Foo int
type Bar int

var Set = wire.NewSet(
	provideFoo,
	provideBar)

func provideFoo() Foo {
	return -888
}

func provideBar(foo Foo) Bar {
	return 2
}
