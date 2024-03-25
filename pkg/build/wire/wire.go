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

// Package wire contains directives for Wire code generation.
// For an overview of working with Wire, see the user guide at
// https://github.com/google/wire/blob/master/docs/guide.md
//
// The directives in this package are used as input to the Wire code generation
// tool. The entry point of Wire's analysis are injector functions: function
// templates denoted by only containing a call to Build. The arguments to Build
// describes a set of providers and the Wire code generation tool builds a
// directed acylic graph of the providers' output types. The generated code will
// fill in the function template by using the providers from the provider set to
// instantiate any needed types.
package wire

// ProviderSet is a marker type that collects a group of providers.
type ProviderSet struct{}

// NewSet creates a new provider set that includes the providers in its
// arguments. Each argument is a function value, a provider set, a call to
// Struct, a call to Bind, a call to Value, a call to InterfaceValue or a call
// to FieldsOf.
//
// Passing a function value to NewSet declares that the function's first
// return value type will be provided by calling the function. The arguments
// to the function will come from the providers for their types. As such, all
// the function's parameters must be of non-identical types. The function may
// optionally return an error as its last return value and a cleanup function
// as the second return value. A cleanup function must be of type func() and is
// guaranteed to be called before the cleanup function of any of the
// provider's inputs. If any provider returns an error, the injector function
// will call all the appropriate cleanup functions and return the error from
// the injector function.
//
// Passing a ProviderSet to NewSet is the same as if the set's contents
// were passed as arguments to NewSet directly.
//
// The behavior of passing the result of a call to other functions in this
// package are described in their respective doc comments.
//
// For compatibility with older versions of Wire, passing a struct value of type
// S to NewSet declares that both S and *S will be provided by creating a new
// value of the appropriate type by filling in each field of S using the
// provider of the field's type. This form is deprecated and will be removed in
// a future version of Wire: new providers sets should use wire.Struct.
func NewSet(...interface{}) ProviderSet {
	return ProviderSet{}
}

// Build is placed in the body of an injector function template to declare the
// providers to use. The Wire code generation tool will fill in an
// implementation of the function. The arguments to Build are interpreted the
// same as NewSet: they determine the provider set presented to Wire's
// dependency graph. Build returns an error message that can be sent to a call
// to panic().
//
// The parameters of the injector function are used as inputs in the dependency
// graph.
//
// Similar to provider functions passed into NewSet, the first return value is
// the output of the injector function, the optional second return value is a
// cleanup function, and the optional last return value is an error. If any of
// the provider functions in the injector function's provider set return errors
// or cleanup functions, the corresponding return value must be present in the
// injector function template.
//
// Examples:
//
//	func injector(ctx context.Context) (*sql.DB, error) {
//		wire.Build(otherpkg.FooSet, myProviderFunc)
//		return nil, nil
//	}
//
//	func injector(ctx context.Context) (*sql.DB, error) {
//		panic(wire.Build(otherpkg.FooSet, myProviderFunc))
//	}
func Build(...interface{}) string {
	return "implementation not generated, run wire"
}

// A Binding maps an interface to a concrete type.
type Binding struct{}

// Bind declares that a concrete type should be used to satisfy a dependency on
// the type of iface. iface must be a pointer to an interface type, to must be a
// pointer to a concrete type.
//
// Example:
//
//	type Fooer interface {
//		Foo()
//	}
//
//	type MyFoo struct{}
//
//	func (MyFoo) Foo() {}
//
//	var MySet = wire.NewSet(
//		wire.Struct(new(MyFoo))
//		wire.Bind(new(Fooer), new(MyFoo)))
func Bind(iface, to interface{}) Binding {
	return Binding{}
}

// bindToUsePointer is detected by the wire tool to indicate that Bind's second argument should take a pointer.
// See https://github.com/google/wire/issues/120 for details.
const bindToUsePointer = true

// A ProvidedValue is an expression that is copied to the generated injector.
type ProvidedValue struct{}

// Value binds an expression to provide the type of the expression.
// The expression may not be an interface value; use InterfaceValue for that.
//
// Example:
//
//	var MySet = wire.NewSet(wire.Value([]string(nil)))
func Value(interface{}) ProvidedValue {
	return ProvidedValue{}
}

// InterfaceValue binds an expression to provide a specific interface type.
// The first argument is a pointer to the interface which user wants to provide.
// The second argument is the actual variable value whose type implements the
// interface.
//
// Example:
//
//	var MySet = wire.NewSet(wire.InterfaceValue(new(io.Reader), os.Stdin))
func InterfaceValue(typ interface{}, x interface{}) ProvidedValue {
	return ProvidedValue{}
}

// A StructProvider represents a named struct.
type StructProvider struct{}

// Struct specifies that the given struct type will be provided by filling in
// the fields in the struct that have the names given.
//
// The first argument must be a pointer to the struct type. For a struct type
// Foo, Wire will use field-filling to provide both Foo and *Foo. The remaining
// arguments are field names to fill in. As a special case, if a single name "*"
// is given, then all of the fields in the struct will be filled in.
//
// For example:
//
//	type S struct {
//	  MyFoo *Foo
//	  MyBar *Bar
//	}
//	var Set = wire.NewSet(wire.Struct(new(S), "MyFoo")) -> inject only S.MyFoo
//	var Set = wire.NewSet(wire.Struct(new(S), "*")) -> inject all fields
func Struct(structType interface{}, fieldNames ...string) StructProvider {
	return StructProvider{}
}

// StructFields is a collection of the fields from a struct.
type StructFields struct{}

// FieldsOf declares that the fields named of the given struct type will be used
// to provide the types of those fields. The structType argument must be a
// pointer to the struct or a pointer to a pointer to the struct it wishes to reference.
//
// The following example would provide Foo and Bar using S.MyFoo and S.MyBar respectively:
//
//	type S struct {
//		MyFoo Foo
//		MyBar Bar
//	}
//
//	func NewStruct() S { /* ... */ }
//	var Set = wire.NewSet(wire.FieldsOf(new(S), "MyFoo", "MyBar"))
//
//	or
//
//	func NewStruct() *S { /* ... */ }
//	var Set = wire.NewSet(wire.FieldsOf(new(*S), "MyFoo", "MyBar"))
//
//	If the structType argument is a pointer to a pointer to a struct, then FieldsOf
//	additionally provides a pointer to each field type (e.g., *Foo and *Bar in the
//	example above).
func FieldsOf(structType interface{}, fieldNames ...string) StructFields {
	return StructFields{}
}
