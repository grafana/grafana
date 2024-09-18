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

// All of the declarations are in one file.
// Wire should copy non-injectors over, preserving imports.

package main

import (
	"fmt"

	"github.com/grafana/grafana/pkg/build/wire"
)

func main() {
	fmt.Println(injectedMessage())
}

// provideMessage provides a friendly user greeting.
func provideMessage() string {
	return "Hello, World!"
}

func injectedMessage() string {
	wire.Build(provideMessage)
	return ""
}
