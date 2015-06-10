// Copyright 2015 Google Inc. All Rights Reserved.
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

// Package reqtrace contains a very simple request tracing framework.
package reqtrace

import (
	"flag"

	"golang.org/x/net/context"
)

type contextKey int

var fEnabled = flag.Bool("reqtrace.enable", false, "Collect and print traces.")

// The key used to associate a *traceState with a context.
const traceStateKey contextKey = 0

// A function that must be called exactly once to report the outcome of an
// operation represented by a span.
type ReportFunc func(error)

// Return false only if traces are disabled, i.e. Trace will never cause a
// trace to be initiated.
//
// REQUIRES: flag.Parsed()
func Enabled() (enabled bool) {
	enabled = *fEnabled
	return
}

// Begin a span within the current trace. Return a new context that should be
// used for operations that logically occur within the span, and a report
// function that must be called with the outcome of the logical operation
// represented by the span.
//
// If no trace is active, no span will be created but ctx and report will still
// be valid.
func StartSpan(
	parent context.Context,
	desc string) (ctx context.Context, report ReportFunc) {
	// Look for the trace state.
	val := parent.Value(traceStateKey)
	if val == nil {
		// Nothing to do.
		ctx = parent
		report = func(err error) {}
		return
	}

	ts := val.(*traceState)

	// Set up the report function.
	report = ts.CreateSpan(desc)

	// For now we don't do anything interesting with the context. In the future,
	// we may use it to record span hierarchy.
	ctx = parent

	return
}

// A wrapper around StartSpan that can be more convenient to use when the
// lifetime of a span matches the lifetime of a function. Intended to be used
// in a defer statement within a function using a named error return parameter.
//
// Equivalent to calling StartSpan with *ctx, replacing *ctx with the resulting
// new context, then setting f to a function that will invoke the report
// function with the contents of *error at the time that it is called.
//
// Example:
//
//     func DoSomething(ctx context.Context) (err error) {
//       defer reqtrace.StartSpanWithError(&ctx, &err, "DoSomething")()
//       [...]
//     }
//
func StartSpanWithError(
	ctx *context.Context,
	err *error,
	desc string) (f func()) {
	var report ReportFunc
	*ctx, report = StartSpan(*ctx, desc)
	f = func() { report(*err) }
	return
}

// Like StartSpan, but begins a root span for a new trace if no trace is active
// in the supplied context and tracing is enabled for the process.
func Trace(
	parent context.Context,
	desc string) (ctx context.Context, report ReportFunc) {
	// If tracing is disabled, this is a no-op.
	if !*fEnabled {
		ctx = parent
		report = func(err error) {}
		return
	}

	// Is this context already being traced? If so, simply add a span.
	if parent.Value(traceStateKey) != nil {
		ctx, report = StartSpan(parent, desc)
		return
	}

	// Set up a new trace state.
	ts := new(traceState)
	baseReport := ts.CreateSpan(desc)

	// Log when finished.
	report = func(err error) {
		baseReport(err)
		ts.Log()
	}

	// Set up the context.
	ctx = context.WithValue(parent, traceStateKey, ts)

	return
}
