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

package oglematchers

import (
	"errors"
	"fmt"
	"reflect"
	"regexp"
)

// MatchesRegexp returns a matcher that matches strings and byte slices whose
// contents match the supplide regular expression. The semantics are those of
// regexp.Match. In particular, that means the match is not implicitly anchored
// to the ends of the string: MatchesRegexp("bar") will match "foo bar baz".
func MatchesRegexp(pattern string) Matcher {
	re, err := regexp.Compile(pattern)
	if err != nil {
		panic("MatchesRegexp: " + err.Error())
	}

	return &matchesRegexpMatcher{re}
}

type matchesRegexpMatcher struct {
	re *regexp.Regexp
}

func (m *matchesRegexpMatcher) Description() string {
	return fmt.Sprintf("matches regexp \"%s\"", m.re.String())
}

func (m *matchesRegexpMatcher) Matches(c interface{}) (err error) {
	v := reflect.ValueOf(c)
	isString := v.Kind() == reflect.String
	isByteSlice := v.Kind() == reflect.Slice && v.Elem().Kind() == reflect.Uint8

	err = errors.New("")

	switch {
	case isString:
		if m.re.MatchString(v.String()) {
			err = nil
		}

	case isByteSlice:
		if m.re.Match(v.Bytes()) {
			err = nil
		}

	default:
		err = NewFatalError("which is not a string or []byte")
	}

	return
}
