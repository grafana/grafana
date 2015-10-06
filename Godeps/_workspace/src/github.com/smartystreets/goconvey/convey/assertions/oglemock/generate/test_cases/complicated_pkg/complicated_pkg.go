// Copyright 2012 Aaron Jacobs. All Rights Reserved.
// Author: aaronjjacobs@gmail.com (Aaron Jacobs)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package complicated_pkg contains an interface with lots of interesting
// cases, for use in integration testing.
package complicated_pkg

import (
	"image"
	"io"
	"net"

	"github.com/smartystreets/goconvey/convey/assertions/oglemock/generate/test_cases/renamed_pkg"
)

type Byte uint8

type ComplicatedThing interface {
	Channels(a chan chan<- <-chan net.Conn) chan int
	Pointers(a *int, b *net.Conn, c **io.Reader) (*int, error)
	Functions(a func(int, image.Image) int) func(string, int) net.Conn
	Maps(a map[string]*int) (map[int]*string, error)
	Arrays(a [3]string) ([3]int, error)
	Slices(a []string) ([]int, error)
	NamedScalarType(a Byte) ([]Byte, error)
	EmptyInterface(a interface{}) (interface{}, error)
	RenamedPackage(a tony.SomeUint8Alias)
	Variadic(a int, b ...net.Conn) int
}
