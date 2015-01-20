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

// Return a matcher that matches non-nil pointers whose pointee matches the
// wrapped matcher.
func Pointee(m Matcher) Matcher {
	return &pointeeMatcher{m}
}

type pointeeMatcher struct {
	wrapped Matcher
}

func (m *pointeeMatcher) Matches(c interface{}) (err error) {
	// Make sure the candidate is of the appropriate type.
	cv := reflect.ValueOf(c)
	if !cv.IsValid() || cv.Kind() != reflect.Ptr {
		return NewFatalError("which is not a pointer")
	}

	// Make sure the candidate is non-nil.
	if cv.IsNil() {
		return NewFatalError("")
	}

	// Defer to the wrapped matcher. Fix up empty errors so that failure messages
	// are more helpful than just printing a pointer for "Actual".
	pointee := cv.Elem().Interface()
	err = m.wrapped.Matches(pointee)
	if err != nil && err.Error() == "" {
		s := fmt.Sprintf("whose pointee is %v", pointee)

		if _, ok := err.(*FatalError); ok {
			err = NewFatalError(s)
		} else {
			err = errors.New(s)
		}
	}

	return err
}

func (m *pointeeMatcher) Description() string {
	return fmt.Sprintf("pointee(%s)", m.wrapped.Description())
}
