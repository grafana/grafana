// Copyright 2012 Aaron Jacobs. All Rights Reserved.
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
	"reflect"
)

// Create an Action that invokes the supplied function, returning whatever it
// returns. The signature of the function must match that of the mocked method
// exactly.
func Invoke(f interface{}) Action {
	// Make sure f is a function.
	fv := reflect.ValueOf(f)
	fk := fv.Kind()

	if fk != reflect.Func {
		desc := "<nil>"
		if fk != reflect.Invalid {
			desc = fv.Type().String()
		}

		panic(fmt.Sprintf("Invoke: expected function, got %s", desc))
	}

	return &invokeAction{fv}
}

type invokeAction struct {
	f reflect.Value
}

func (a *invokeAction) SetSignature(signature reflect.Type) error {
	// The signature must match exactly.
	ft := a.f.Type()
	if ft != signature {
		return errors.New(fmt.Sprintf("Invoke: expected %v, got %v", signature, ft))
	}

	return nil
}

func (a *invokeAction) Invoke(vals []interface{}) []interface{} {
	// Create a slice of args for the function.
	in := make([]reflect.Value, len(vals))
	for i, x := range vals {
		in[i] = reflect.ValueOf(x)
	}

	// Call the function and return its return values.
	out := a.f.Call(in)
	result := make([]interface{}, len(out))
	for i, v := range out {
		result[i] = v.Interface()
	}

	return result
}
