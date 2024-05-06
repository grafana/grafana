// Copyright 2019 The Wire Authors
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
	fmt.Println(injectFoo())
}

type fooer interface {
	Do() string
}

type foo struct{}

func (f *foo) Do() string {
	return "did foo"
}

func newFoo() *foo {
	return &foo{}
}

var (
	setA = wire.NewSet(newFoo)
	// This set is invalid because it has a wire.Bind but no matching provider.
	// From the user guide:
	// Any set that includes an interface binding must also have a provider in
	// the same set that provides the concrete type.
	setB = wire.NewSet(wire.Bind(new(fooer), new(*foo)))
	setC = wire.NewSet(setA, setB)
)
