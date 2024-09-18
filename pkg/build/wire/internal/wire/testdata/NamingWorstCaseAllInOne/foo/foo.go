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

// This file is specifically designed to cause issues with copying the
// AST, particularly with the identifier "context".

package main

import (
	stdcontext "context"
	"fmt"
	"os"
	"reflect"

	"github.com/grafana/grafana/pkg/build/wire"
)

type context struct{}

func main() {
	if _, ok := reflect.TypeOf(context{}).MethodByName("Provide"); !ok {
		fmt.Println("ERROR: context.Provide renamed")
		os.Exit(1)
	}
	c, err := inject(stdcontext.Background(), struct{}{})
	if err != nil {
		fmt.Println("ERROR:", err)
		os.Exit(1)
	}
	fmt.Println(c)
}

func Provide(context2 stdcontext.Context) (context, error) {
	var context3 = stdcontext.Background()
	_ = context2
	_ = context3
	return context{}, nil
}

func inject(context stdcontext.Context, err struct{}) (context, error) {
	panic(wire.Build(Provide))
}

func (context) Provide() {
}
