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
	"strings"
)

// Given a list of arguments M, ElementsAre returns a matcher that matches
// arrays and slices A where all of the following hold:
//
//  *  A is the same length as M.
//
//  *  For each i < len(A) where M[i] is a matcher, A[i] matches M[i].
//
//  *  For each i < len(A) where M[i] is not a matcher, A[i] matches
//     Equals(M[i]).
//
func ElementsAre(M ...interface{}) Matcher {
	// Copy over matchers, or convert to Equals(x) for non-matcher x.
	subMatchers := make([]Matcher, len(M))
	for i, x := range M {
		if matcher, ok := x.(Matcher); ok {
			subMatchers[i] = matcher
			continue
		}

		subMatchers[i] = Equals(x)
	}

	return &elementsAreMatcher{subMatchers}
}

type elementsAreMatcher struct {
	subMatchers []Matcher
}

func (m *elementsAreMatcher) Description() string {
	subDescs := make([]string, len(m.subMatchers))
	for i, sm := range m.subMatchers {
		subDescs[i] = sm.Description()
	}

	return fmt.Sprintf("elements are: [%s]", strings.Join(subDescs, ", "))
}

func (m *elementsAreMatcher) Matches(candidates interface{}) error {
	// The candidate must be a slice or an array.
	v := reflect.ValueOf(candidates)
	if v.Kind() != reflect.Slice && v.Kind() != reflect.Array {
		return NewFatalError("which is not a slice or array")
	}

	// The length must be correct.
	if v.Len() != len(m.subMatchers) {
		return errors.New(fmt.Sprintf("which is of length %d", v.Len()))
	}

	// Check each element.
	for i, subMatcher := range m.subMatchers {
		c := v.Index(i)
		if matchErr := subMatcher.Matches(c.Interface()); matchErr != nil {
			// Return an errors indicating which element doesn't match. If the
			// matcher error was fatal, make this one fatal too.
			err := errors.New(fmt.Sprintf("whose element %d doesn't match", i))
			if _, isFatal := matchErr.(*FatalError); isFatal {
				err = NewFatalError(err.Error())
			}

			return err
		}
	}

	return nil
}
