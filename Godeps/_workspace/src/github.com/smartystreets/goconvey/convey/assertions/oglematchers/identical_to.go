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

package oglematchers

import (
	"errors"
	"fmt"
	"reflect"
)

// Is the type comparable according to the definition here?
//
//     http://weekly.golang.org/doc/go_spec.html#Comparison_operators
//
func isComparable(t reflect.Type) bool {
	switch t.Kind() {
	case reflect.Array:
		return isComparable(t.Elem())

	case reflect.Struct:
		for i := 0; i < t.NumField(); i++ {
			if !isComparable(t.Field(i).Type) {
				return false
			}
		}

		return true

	case reflect.Slice, reflect.Map, reflect.Func:
		return false
	}

	return true
}

// Should the supplied type be allowed as an argument to IdenticalTo?
func isLegalForIdenticalTo(t reflect.Type) (bool, error) {
	// Allow the zero type.
	if t == nil {
		return true, nil
	}

	// Reference types are always okay; we compare pointers.
	switch t.Kind() {
	case reflect.Slice, reflect.Map, reflect.Func, reflect.Chan:
		return true, nil
	}

	// Reject other non-comparable types.
	if !isComparable(t) {
		return false, errors.New(fmt.Sprintf("%v is not comparable", t))
	}

	return true, nil
}

// IdenticalTo(x) returns a matcher that matches values v with type identical
// to x such that:
//
//  1. If v and x are of a reference type (slice, map, function, channel), then
//     they are either both nil or are references to the same object.
//
//  2. Otherwise, if v and x are not of a reference type but have a valid type,
//     then v == x.
//
// If v and x are both the invalid type (which results from the predeclared nil
// value, or from nil interface variables), then the matcher is satisfied.
//
// This function will panic if x is of a value type that is not comparable. For
// example, x cannot be an array of functions.
func IdenticalTo(x interface{}) Matcher {
	t := reflect.TypeOf(x)

	// Reject illegal arguments.
	if ok, err := isLegalForIdenticalTo(t); !ok {
		panic("IdenticalTo: " + err.Error())
	}

	return &identicalToMatcher{x}
}

type identicalToMatcher struct {
	x interface{}
}

func (m *identicalToMatcher) Description() string {
	t := reflect.TypeOf(m.x)
	return fmt.Sprintf("identical to <%v> %v", t, m.x)
}

func (m *identicalToMatcher) Matches(c interface{}) error {
	// Make sure the candidate's type is correct.
	t := reflect.TypeOf(m.x)
	if ct := reflect.TypeOf(c); t != ct {
		return NewFatalError(fmt.Sprintf("which is of type %v", ct))
	}

	// Special case: two values of the invalid type are always identical.
	if t == nil {
		return nil
	}

	// Handle reference types.
	switch t.Kind() {
	case reflect.Slice, reflect.Map, reflect.Func, reflect.Chan:
		xv := reflect.ValueOf(m.x)
		cv := reflect.ValueOf(c)
		if xv.Pointer() == cv.Pointer() {
			return nil
		}

		return errors.New("which is not an identical reference")
	}

	// Are the values equal?
	if m.x == c {
		return nil
	}

	return errors.New("")
}
