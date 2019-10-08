// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package array

import (
	"sync/atomic"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/internal/debug"
	"github.com/apache/arrow/go/arrow/memory"
)

// A type which represents the memory and metadata for an Arrow array.
type Data struct {
	refCount  int64
	dtype     arrow.DataType
	nulls     int
	offset    int
	length    int
	buffers   []*memory.Buffer // TODO(sgc): should this be an interface?
	childData []*Data          // TODO(sgc): managed by ListArray, StructArray and UnionArray types
}

func NewData(dtype arrow.DataType, length int, buffers []*memory.Buffer, childData []*Data, nulls, offset int) *Data {
	for _, b := range buffers {
		if b != nil {
			b.Retain()
		}
	}

	for _, child := range childData {
		if child != nil {
			child.Retain()
		}
	}

	return &Data{
		refCount:  1,
		dtype:     dtype,
		nulls:     nulls,
		length:    length,
		offset:    offset,
		buffers:   buffers,
		childData: childData,
	}
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (d *Data) Retain() {
	atomic.AddInt64(&d.refCount, 1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (d *Data) Release() {
	debug.Assert(atomic.LoadInt64(&d.refCount) > 0, "too many releases")

	if atomic.AddInt64(&d.refCount, -1) == 0 {
		for _, b := range d.buffers {
			if b != nil {
				b.Release()
			}
		}

		for _, b := range d.childData {
			b.Release()
		}
		d.buffers, d.childData = nil, nil
	}
}

func (d *Data) DataType() arrow.DataType  { return d.dtype }
func (d *Data) NullN() int                { return d.nulls }
func (d *Data) Len() int                  { return d.length }
func (d *Data) Offset() int               { return d.offset }
func (d *Data) Buffers() []*memory.Buffer { return d.buffers }

// NewSliceData returns a new slice that shares backing data with the input.
// The returned Data slice starts at i and extends j-i elements, such as:
//    slice := data[i:j]
// The returned value must be Release'd after use.
//
// NewSliceData panics if the slice is outside the valid range of the input Data.
// NewSliceData panics if j < i.
func NewSliceData(data *Data, i, j int64) *Data {
	if j > int64(data.length) || i > j || data.offset+int(i) > data.length {
		panic("arrow/array: index out of range")
	}

	for _, b := range data.buffers {
		if b != nil {
			b.Retain()
		}
	}

	for _, child := range data.childData {
		if child != nil {
			child.Retain()
		}
	}

	o := &Data{
		refCount:  1,
		dtype:     data.dtype,
		nulls:     UnknownNullCount,
		length:    int(j - i),
		offset:    data.offset + int(i),
		buffers:   data.buffers,
		childData: data.childData,
	}

	if data.nulls == 0 {
		o.nulls = 0
	}

	return o
}
