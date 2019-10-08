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
	"bytes"
	"fmt"
	"strings"

	"github.com/apache/arrow/go/arrow"
)

// A type which represents an immutable sequence of fixed-length binary strings.
type FixedSizeBinary struct {
	array

	valueBytes []byte
	bytewidth  int32
}

// NewFixedSizeBinaryData constructs a new fixed-size binary array from data.
func NewFixedSizeBinaryData(data *Data) *FixedSizeBinary {
	a := &FixedSizeBinary{bytewidth: int32(data.DataType().(arrow.FixedWidthDataType).BitWidth() / 8)}
	a.refCount = 1
	a.setData(data)
	return a
}

// Value returns the fixed-size slice at index i. This value should not be mutated.
func (a *FixedSizeBinary) Value(i int) []byte {
	i += a.array.data.offset
	var (
		bw  = int(a.bytewidth)
		beg = i * bw
		end = (i + 1) * bw
	)
	return a.valueBytes[beg:end]
}

func (a *FixedSizeBinary) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString("(null)")
		default:
			fmt.Fprintf(o, "%q", a.Value(i))
		}
	}
	o.WriteString("]")
	return o.String()
}

func (a *FixedSizeBinary) setData(data *Data) {
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.valueBytes = vals.Bytes()
	}

}

func arrayEqualFixedSizeBinary(left, right *FixedSizeBinary) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if bytes.Compare(left.Value(i), right.Value(i)) != 0 {
			return false
		}
	}
	return true
}

var (
	_ Interface = (*FixedSizeBinary)(nil)
)
