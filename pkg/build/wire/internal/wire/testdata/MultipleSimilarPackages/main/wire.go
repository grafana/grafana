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

package main

import (
	"fmt"

	"example.com/bar"
	"example.com/baz"
	"example.com/foo"
	"github.com/grafana/grafana/pkg/build/wire"
)

type MainConfig struct {
	Foo *foo.Config
	Bar *bar.Config
	baz *baz.Config
}

type MainService struct {
	Foo *foo.Service
	Bar *bar.Service
	baz *baz.Service
}

func (m *MainService) String() string {
	return fmt.Sprintf("%d %d %d", m.Foo.Cfg.V, m.Bar.Cfg.V, m.baz.Cfg.V)
}

func newMainService(MainConfig) *MainService {
	wire.Build(
		wire.Struct(new(MainService), "Foo", "Bar", "baz"),
		wire.FieldsOf(
			new(MainConfig),
			"Foo",
			"Bar",
			"baz",
		),
		foo.New,
		bar.New,
		baz.New,
	)
	return nil
}

func main() {
	cfg := MainConfig{
		Foo: &foo.Config{1},
		Bar: &bar.Config{2},
		baz: &baz.Config{3},
	}
	svc := newMainService(cfg)
	fmt.Println(svc.String())
}
