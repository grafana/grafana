// Copyright 2011 Aaron Jacobs. All Rights Reserved.
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

package oglemock

import (
	"errors"
	"fmt"
	"math"
	"reflect"
)

var intType = reflect.TypeOf(int(0))
var float64Type = reflect.TypeOf(float64(0))
var complex128Type = reflect.TypeOf(complex128(0))

// Return creates an Action that returns the values passed to Return as
// arguments, after suitable legal type conversions. The following rules apply.
// Given an argument x to Return and a corresponding type T in the method's
// signature, at least one of the following must hold:
//
//  *  x is assignable to T. (See "Assignability" in the language spec.) Note
//     that this in particular applies that x may be a type that implements an
//     interface T. It also implies that the nil literal can be used if T is a
//     pointer, function, interface, slice, channel, or map type.
//
//  *  T is any numeric type, and x is an int that is in-range for that type.
//     This facilities using raw integer constants: Return(17).
//
//  *  T is a floating-point or complex number type, and x is a float64.  This
//     facilities using raw floating-point constants: Return(17.5).
//
//  *  T is a complex number type, and x is a complex128. This facilities using
//     raw complex constants: Return(17+2i).
//
func Return(vals ...interface{}) Action {
	return &returnAction{vals, nil}
}

type returnAction struct {
	returnVals []interface{}
	signature  reflect.Type
}

func (a *returnAction) Invoke(vals []interface{}) []interface{} {
	if a.signature == nil {
		panic("You must first call SetSignature with a valid signature.")
	}

	res, err := a.buildInvokeResult(a.signature)
	if err != nil {
		panic(err)
	}

	return res
}

func (a *returnAction) SetSignature(signature reflect.Type) error {
	if _, err := a.buildInvokeResult(signature); err != nil {
		return err
	}

	a.signature = signature
	return nil
}

// A version of Invoke that does error checking, used by both public methods.
func (a *returnAction) buildInvokeResult(
	sig reflect.Type) (res []interface{}, err error) {
	// Check the length of the return value.
	numOut := sig.NumOut()
	numVals := len(a.returnVals)

	if numOut != numVals {
		err = errors.New(
			fmt.Sprintf("Return given %d vals; expected %d.", numVals, numOut))
		return
	}

	// Attempt to coerce each return value.
	res = make([]interface{}, numOut)

	for i, val := range a.returnVals {
		resType := sig.Out(i)
		res[i], err = a.coerce(val, resType)

		if err != nil {
			res = nil
			err = errors.New(fmt.Sprintf("Return: arg %d: %v", i, err))
			return
		}
	}

	return
}

func (a *returnAction) coerce(x interface{}, t reflect.Type) (interface{}, error) {
	xv := reflect.ValueOf(x)
	rv := reflect.New(t).Elem()

	// Special case: the language spec says that the predeclared identifier nil
	// is assignable to pointers, functions, interface, slices, channels, and map
	// types. However, reflect.ValueOf(nil) returns an invalid value that will
	// not cooperate below. So handle invalid values here, assuming that they
	// resulted from Return(nil).
	if !xv.IsValid() {
		switch t.Kind() {
		case reflect.Ptr, reflect.Func, reflect.Interface, reflect.Chan, reflect.Slice, reflect.Map, reflect.UnsafePointer:
			return rv.Interface(), nil
		}

		return nil, errors.New(fmt.Sprintf("expected %v, given <nil>", t))
	}

	// If x is assignable to type t, let the reflect package do the heavy
	// lifting.
	if reflect.TypeOf(x).AssignableTo(t) {
		rv.Set(xv)
		return rv.Interface(), nil
	}

	// Handle numeric types as described in the documentation on Return.
	switch {
	case xv.Type() == intType && a.isNumeric(t):
		return a.coerceInt(xv.Int(), t)

	case xv.Type() == float64Type && (a.isFloatingPoint(t) || a.isComplex(t)):
		return a.coerceFloat(xv.Float(), t)

	case xv.Type() == complex128Type && a.isComplex(t):
		return a.coerceComplex(xv.Complex(), t)
	}

	// The value wasn't of a legal type.
	return nil, errors.New(fmt.Sprintf("expected %v, given %v", t, xv.Type()))
}

func (a *returnAction) isNumeric(t reflect.Type) bool {
	return (t.Kind() >= reflect.Int && t.Kind() <= reflect.Uint64) ||
		a.isFloatingPoint(t) ||
		a.isComplex(t)
}

func (a *returnAction) isFloatingPoint(t reflect.Type) bool {
	return t.Kind() == reflect.Float32 || t.Kind() == reflect.Float64
}

func (a *returnAction) isComplex(t reflect.Type) bool {
	return t.Kind() == reflect.Complex64 || t.Kind() == reflect.Complex128
}

func (a *returnAction) coerceInt(x int64, t reflect.Type) (interface{}, error) {
	k := t.Kind()

	// Floating point and complex numbers: promote appropriately.
	if a.isFloatingPoint(t) || a.isComplex(t) {
		return a.coerceFloat(float64(x), t)
	}

	// Integers: range check.
	var min, max int64
	unsigned := false

	switch k {
	case reflect.Int8:
		min = math.MinInt8
		max = math.MaxInt8

	case reflect.Int16:
		min = math.MinInt16
		max = math.MaxInt16

	case reflect.Int32:
		min = math.MinInt32
		max = math.MaxInt32

	case reflect.Int64:
		min = math.MinInt64
		max = math.MaxInt64

	case reflect.Uint:
		unsigned = true
		min = 0
		max = math.MaxUint32

	case reflect.Uint8:
		unsigned = true
		min = 0
		max = math.MaxUint8

	case reflect.Uint16:
		unsigned = true
		min = 0
		max = math.MaxUint16

	case reflect.Uint32:
		unsigned = true
		min = 0
		max = math.MaxUint32

	case reflect.Uint64:
		unsigned = true
		min = 0
		max = math.MaxInt64

	default:
		panic(fmt.Sprintf("Unexpected type: %v", t))
	}

	if x < min || x > max {
		return nil, errors.New("int value out of range")
	}

	rv := reflect.New(t).Elem()
	if unsigned {
		rv.SetUint(uint64(x))
	} else {
		rv.SetInt(x)
	}

	return rv.Interface(), nil
}

func (a *returnAction) coerceFloat(x float64, t reflect.Type) (interface{}, error) {
	// Promote complex numbers.
	if a.isComplex(t) {
		return a.coerceComplex(complex(x, 0), t)
	}

	rv := reflect.New(t).Elem()
	rv.SetFloat(x)
	return rv.Interface(), nil
}

func (a *returnAction) coerceComplex(x complex128, t reflect.Type) (interface{}, error) {
	rv := reflect.New(t).Elem()
	rv.SetComplex(x)
	return rv.Interface(), nil
}
