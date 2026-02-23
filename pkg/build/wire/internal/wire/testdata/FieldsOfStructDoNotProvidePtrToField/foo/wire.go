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
	"github.com/grafana/grafana/pkg/build/wire"
)

func injectedMessagePtr() *string {
	// This shouldn't work; FieldsOf provides a pointer to the
	// field only when the struct type is a pointer to a struct.
	// See FieldsOfStructPointer for a working example using
	// a pointer to a struct.
	wire.Build(
		provideS,
		wire.FieldsOf(new(S), "Foo"))
	return nil
}
