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
)

// Not returns a matcher that inverts the set of values matched by the wrapped
// matcher. It does not transform the result for values for which the wrapped
// matcher returns a fatal error.
func Not(m Matcher) Matcher {
	return &notMatcher{m}
}

type notMatcher struct {
	wrapped Matcher
}

func (m *notMatcher) Matches(c interface{}) (err error) {
	err = m.wrapped.Matches(c)

	// Did the wrapped matcher say yes?
	if err == nil {
		return errors.New("")
	}

	// Did the wrapped matcher return a fatal error?
	if _, isFatal := err.(*FatalError); isFatal {
		return err
	}

	// The wrapped matcher returned a non-fatal error.
	return nil
}

func (m *notMatcher) Description() string {
	return fmt.Sprintf("not(%s)", m.wrapped.Description())
}
