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

//go:build wireinject
// +build wireinject

package main

import (
	"fmt"

	"example.com/bar"
	"example.com/baz"
	"example.com/foo"
	"github.com/grafana/grafana/pkg/build/wire"
)

func newBazService(*baz.Config) *baz.Service {
	wire.Build(
		wire.Struct(new(baz.Service), "*"),
		wire.FieldsOf(
			new(*baz.Config),
			"Foo",
			"Bar",
		),
		foo.New,
		bar.New,
	)
	return nil
}

func main() {
	cfg := &baz.Config{
		Foo: &foo.Config{1},
		Bar: &bar.Config{2},
	}
	svc := newBazService(cfg)
	fmt.Println(svc.String())
}
