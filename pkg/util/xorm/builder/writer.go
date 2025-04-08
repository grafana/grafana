// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"io"
	"strings"
)

// Writer defines the interface
type Writer interface {
	io.Writer
	Append(...interface{})
}

var _ Writer = NewWriter()

// BytesWriter implments Writer and save SQL in bytes.Buffer
type BytesWriter struct {
	*strings.Builder
	args []interface{}
}

// NewWriter creates a new string writer
func NewWriter() *BytesWriter {
	w := &BytesWriter{
		Builder: &strings.Builder{},
	}
	return w
}

// Append appends args to Writer
func (w *BytesWriter) Append(args ...interface{}) {
	w.args = append(w.args, args...)
}

// Args returns args
func (w *BytesWriter) Args() []interface{} {
	return w.args
}
