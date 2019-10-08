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
	"fmt"
	"strings"
	"sync/atomic"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/internal/bitutil"
	"github.com/apache/arrow/go/arrow/internal/debug"
	"github.com/apache/arrow/go/arrow/memory"
)

// List represents an immutable sequence of array values.
type List struct {
	array
	values  Interface
	offsets []int32
}

// NewListData returns a new List array value, from data.
func NewListData(data *Data) *List {
	a := &List{}
	a.refCount = 1
	a.setData(data)
	return a
}

func (a *List) ListValues() Interface { return a.values }

func (a *List) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		if !a.IsValid(i) {
			o.WriteString("(null)")
			continue
		}
		sub := a.newListValue(i)
		fmt.Fprintf(o, "%v", sub)
		sub.Release()
	}
	o.WriteString("]")
	return o.String()
}

func (a *List) newListValue(i int) Interface {
	j := i + a.array.data.offset
	beg := int64(a.offsets[j])
	end := int64(a.offsets[j+1])
	return NewSlice(a.values, beg, end)
}

func (a *List) setData(data *Data) {
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.offsets = arrow.Int32Traits.CastFromBytes(vals.Bytes())
	}
	a.values = MakeFromData(data.childData[0])
}

func arrayEqualList(left, right *List) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		o := func() bool {
			l := left.newListValue(i)
			defer l.Release()
			r := right.newListValue(i)
			defer r.Release()
			return ArrayEqual(l, r)
		}()
		if !o {
			return false
		}
	}
	return true
}

// Len returns the number of elements in the array.
func (a *List) Len() int { return a.array.Len() }

func (a *List) Offsets() []int32 { return a.offsets }

func (a *List) Retain() {
	a.array.Retain()
	a.values.Retain()
}

func (a *List) Release() {
	a.array.Release()
	a.values.Release()
}

type ListBuilder struct {
	builder

	etype   arrow.DataType // data type of the list's elements.
	values  Builder        // value builder for the list's elements.
	offsets *Int32Builder
}

// NewListBuilder returns a builder, using the provided memory allocator.
// The created list builder will create a list whose elements will be of type etype.
func NewListBuilder(mem memory.Allocator, etype arrow.DataType) *ListBuilder {
	return &ListBuilder{
		builder: builder{refCount: 1, mem: mem},
		etype:   etype,
		values:  newBuilder(mem, etype),
		offsets: NewInt32Builder(mem),
	}
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *ListBuilder) Release() {
	debug.Assert(atomic.LoadInt64(&b.refCount) > 0, "too many releases")

	if atomic.AddInt64(&b.refCount, -1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
	}

	b.values.Release()
	b.offsets.Release()
}

func (b *ListBuilder) appendNextOffset() {
	b.offsets.Append(int32(b.values.Len()))
}

func (b *ListBuilder) Append(v bool) {
	b.Reserve(1)
	b.unsafeAppendBoolToBitmap(v)
	b.appendNextOffset()
}

func (b *ListBuilder) AppendNull() {
	b.Reserve(1)
	b.unsafeAppendBoolToBitmap(false)
	b.appendNextOffset()
}

func (b *ListBuilder) AppendValues(offsets []int32, valid []bool) {
	b.Reserve(len(valid))
	b.offsets.AppendValues(offsets, nil)
	b.builder.unsafeAppendBoolsToBitmap(valid, len(valid))
}

func (b *ListBuilder) unsafeAppend(v bool) {
	bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	b.length++
}

func (b *ListBuilder) unsafeAppendBoolToBitmap(isValid bool) {
	if isValid {
		bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	} else {
		b.nulls++
	}
	b.length++
}

func (b *ListBuilder) init(capacity int) {
	b.builder.init(capacity)
	b.offsets.init(capacity + 1)
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *ListBuilder) Reserve(n int) {
	b.builder.reserve(n, b.Resize)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *ListBuilder) Resize(n int) {
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.builder.resize(n, b.builder.init)
		b.offsets.resize(n+1, b.offsets.init)
	}
}

func (b *ListBuilder) ValueBuilder() Builder {
	return b.values
}

// NewArray creates a List array from the memory buffers used by the builder and resets the ListBuilder
// so it can be used to build a new array.
func (b *ListBuilder) NewArray() Interface {
	return b.NewListArray()
}

// NewListArray creates a List array from the memory buffers used by the builder and resets the ListBuilder
// so it can be used to build a new array.
func (b *ListBuilder) NewListArray() (a *List) {
	if b.offsets.Len() != b.length+1 {
		b.appendNextOffset()
	}
	data := b.newData()
	a = NewListData(data)
	data.Release()
	return
}

func (b *ListBuilder) newData() (data *Data) {
	values := b.values.NewArray()
	defer values.Release()

	var offsets *memory.Buffer
	if b.offsets != nil {
		arr := b.offsets.NewInt32Array()
		defer arr.Release()
		offsets = arr.Data().buffers[1]
	}

	data = NewData(
		arrow.ListOf(b.etype), b.length,
		[]*memory.Buffer{
			b.nullBitmap,
			offsets,
		},
		[]*Data{values.Data()},
		b.nulls,
		0,
	)
	b.reset()

	return
}

var (
	_ Interface = (*List)(nil)
	_ Builder   = (*ListBuilder)(nil)
)
