// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*
Package arrow provides an implementation of Apache Arrow.

Apache Arrow is a cross-language development platform for in-memory data. It specifies a standardized
language-independent columnar memory format for flat and hierarchical data, organized for efficient analytic
operations on modern hardware. It also provides computational libraries and zero-copy streaming
messaging and inter-process communication.

Basics

The fundamental data structure in Arrow is an Array, which holds a sequence of values of the same type. An array
consists of memory holding the data and an additional validity bitmap that indicates if the corresponding entry in the
array is valid (not null). If the array has no null entries, it is possible to omit this bitmap.

*/
package arrow

//go:generate go run _tools/tmpl/main.go -i -data=numeric.tmpldata type_traits_numeric.gen.go.tmpl type_traits_numeric.gen_test.go.tmpl array/numeric.gen.go.tmpl array/numericbuilder.gen.go.tmpl array/bufferbuilder_numeric.gen.go.tmpl
//go:generate go run _tools/tmpl/main.go -i -data=datatype_numeric.gen.go.tmpldata datatype_numeric.gen.go.tmpl tensor/numeric.gen.go.tmpl tensor/numeric.gen_test.go.tmpl
//go:generate go run ./gen-flatbuffers.go

// stringer
//go:generate stringer -type=Type
