package util

import "reflect"

// IsInterfaceNil checks if an interface is nil or holds a nil value.
//
// This function addresses the Go "nil interface" gotcha where an interface
// can be != nil but still hold a nil value of a specific type.
//
// The Problem:
// In Go, an interface value consists of two parts: a type and a value.
// An interface is only considered nil when both parts are nil.
// However, if you assign a typed nil (e.g., (*MyType)(nil)) to an interface,
// the interface becomes != nil even though it holds a nil value.
//
// Example of the gotcha:
//   var p *int = nil        // p is a nil pointer
//   var i interface{} = p   // i holds a typed nil (*int)(nil)
//   fmt.Println(i == nil)   // prints: false (this is the gotcha!)
//   fmt.Println(IsInterfaceNil(i)) // prints: true (correctly identifies nil)
//
// Common scenario with error interfaces:
//   func doSomething() error {
//       var err *MyError = nil
//       if someCondition {
//           err = &MyError{msg: "failed"}
//       }
//       return err  // returns interface{} containing (*MyError)(nil)
//   }
//   
//   if err := doSomething(); err != nil {  // this check fails!
//       // This code won't run even when err contains nil
//   }
//   
//   if err := doSomething(); !IsInterfaceNil(err) {
//       // This correctly identifies the nil error
//   }
//
// Supported types: Ptr, Slice, Map, Func, Interface
// Unsupported nilable types: Chan, UnsafePointer (these return false even when nil)
//
// See more about this Go gotcha at:
// https://go.dev/doc/faq#nil_error
// https://medium.com/@moksh.9/go-gotcha-when-nil-isnt-really-nil-ddf632720001
func IsInterfaceNil(i interface{}) bool {
	iv := reflect.ValueOf(i)
	if !iv.IsValid() {
		return true
	}
	switch iv.Kind() {
	case reflect.Ptr, reflect.Slice, reflect.Map, reflect.Func, reflect.Interface:
		return iv.IsNil()
	default:
		return false
	}
}
