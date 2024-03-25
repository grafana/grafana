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

package wire

import (
	"go/token"
)

// errorCollector manages a list of errors. The zero value is an empty list.
type errorCollector struct {
	errors []error
}

// add appends any non-nil errors to the collector.
func (ec *errorCollector) add(errs ...error) {
	for _, e := range errs {
		if e != nil {
			ec.errors = append(ec.errors, e)
		}
	}
}

// mapErrors returns a new slice that wraps any errors using the given function.
func mapErrors(errs []error, f func(error) error) []error {
	if len(errs) == 0 {
		return nil
	}
	newErrs := make([]error, len(errs))
	for i := range errs {
		newErrs[i] = f(errs[i])
	}
	return newErrs
}

// A wireErr is an error with an optional position.
type wireErr struct {
	error    error
	position token.Position
}

// notePosition wraps an error with position information if it doesn't already
// have it.
//
// notePosition is usually called multiple times as an error goes up the call
// stack, so calling notePosition on an existing *wireErr will not modify the
// position, as the assumption is that deeper calls have more precise position
// information about the source of the error.
func notePosition(p token.Position, e error) error {
	switch e.(type) {
	case nil:
		return nil
	case *wireErr:
		return e
	default:
		return &wireErr{error: e, position: p}
	}
}

// notePositionAll wraps a list of errors with the given position.
func notePositionAll(p token.Position, errs []error) []error {
	return mapErrors(errs, func(e error) error {
		return notePosition(p, e)
	})
}

// Error returns the error message prefixed by the position if valid.
func (w *wireErr) Error() string {
	if !w.position.IsValid() {
		return w.error.Error()
	}
	return w.position.String() + ": " + w.error.Error()
}
