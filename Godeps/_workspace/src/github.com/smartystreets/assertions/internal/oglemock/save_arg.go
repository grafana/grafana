// Copyright 2015 Aaron Jacobs. All Rights Reserved.
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
	"fmt"
	"reflect"
)

// Create an Action that saves the argument at the given zero-based index to
// the supplied destination, which must be a pointer to a type that is
// assignable from the argument type.
func SaveArg(index int, dst interface{}) Action {
	return &saveArg{
		index:      index,
		dstPointer: dst,
	}
}

type saveArg struct {
	index      int
	dstPointer interface{}

	// Set by SetSignature.
	dstValue reflect.Value
}

func (a *saveArg) SetSignature(signature reflect.Type) (err error) {
	// Extract the source type.
	if a.index >= signature.NumIn() {
		err = fmt.Errorf(
			"Out of range argument index %v for function type %v",
			a.index,
			signature)
		return
	}

	srcType := signature.In(a.index)

	// The destination must be a pointer.
	v := reflect.ValueOf(a.dstPointer)
	if v.Kind() != reflect.Ptr {
		err = fmt.Errorf("Destination is %v, not a pointer", v.Kind())
		return
	}

	// Dereference the pointer.
	if v.IsNil() {
		err = fmt.Errorf("Destination pointer must be non-nil")
		return
	}

	a.dstValue = v.Elem()

	// The destination must be assignable from the source.
	if !srcType.AssignableTo(a.dstValue.Type()) {
		err = fmt.Errorf(
			"%v is not assignable to %v",
			srcType,
			a.dstValue.Type())
		return
	}

	return
}

func (a *saveArg) Invoke(methodArgs []interface{}) (rets []interface{}) {
	a.dstValue.Set(reflect.ValueOf(methodArgs[a.index]))
	return
}
