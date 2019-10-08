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

package arrow

import (
	"encoding/binary"
	"reflect"
	"unsafe"
)

var (
	MonthIntervalTraits   monthTraits
	DayTimeIntervalTraits daytimeTraits
)

// MonthInterval traits

const (
	// MonthIntervalSizeBytes specifies the number of bytes required to store a single MonthInterval in memory
	MonthIntervalSizeBytes = int(unsafe.Sizeof(MonthInterval(0)))
)

type monthTraits struct{}

// BytesRequired returns the number of bytes required to store n elements in memory.
func (monthTraits) BytesRequired(n int) int { return MonthIntervalSizeBytes * n }

// PutValue
func (monthTraits) PutValue(b []byte, v MonthInterval) {
	binary.LittleEndian.PutUint32(b, uint32(v))
}

// CastFromBytes reinterprets the slice b to a slice of type MonthInterval.
//
// NOTE: len(b) must be a multiple of MonthIntervalSizeBytes.
func (monthTraits) CastFromBytes(b []byte) []MonthInterval {
	h := (*reflect.SliceHeader)(unsafe.Pointer(&b))

	var res []MonthInterval
	s := (*reflect.SliceHeader)(unsafe.Pointer(&res))
	s.Data = h.Data
	s.Len = h.Len / MonthIntervalSizeBytes
	s.Cap = h.Cap / MonthIntervalSizeBytes

	return res
}

// CastToBytes reinterprets the slice b to a slice of bytes.
func (monthTraits) CastToBytes(b []MonthInterval) []byte {
	h := (*reflect.SliceHeader)(unsafe.Pointer(&b))

	var res []byte
	s := (*reflect.SliceHeader)(unsafe.Pointer(&res))
	s.Data = h.Data
	s.Len = h.Len * MonthIntervalSizeBytes
	s.Cap = h.Cap * MonthIntervalSizeBytes

	return res
}

// Copy copies src to dst.
func (monthTraits) Copy(dst, src []MonthInterval) { copy(dst, src) }

// DayTimeInterval traits

const (
	// DayTimeIntervalSizeBytes specifies the number of bytes required to store a single DayTimeInterval in memory
	DayTimeIntervalSizeBytes = int(unsafe.Sizeof(DayTimeInterval{}))
)

type daytimeTraits struct{}

// BytesRequired returns the number of bytes required to store n elements in memory.
func (daytimeTraits) BytesRequired(n int) int { return DayTimeIntervalSizeBytes * n }

// PutValue
func (daytimeTraits) PutValue(b []byte, v DayTimeInterval) {
	binary.LittleEndian.PutUint32(b[0:4], uint32(v.Days))
	binary.LittleEndian.PutUint32(b[4:8], uint32(v.Milliseconds))
}

// CastFromBytes reinterprets the slice b to a slice of type DayTimeInterval.
//
// NOTE: len(b) must be a multiple of DayTimeIntervalSizeBytes.
func (daytimeTraits) CastFromBytes(b []byte) []DayTimeInterval {
	h := (*reflect.SliceHeader)(unsafe.Pointer(&b))

	var res []DayTimeInterval
	s := (*reflect.SliceHeader)(unsafe.Pointer(&res))
	s.Data = h.Data
	s.Len = h.Len / DayTimeIntervalSizeBytes
	s.Cap = h.Cap / DayTimeIntervalSizeBytes

	return res
}

// CastToBytes reinterprets the slice b to a slice of bytes.
func (daytimeTraits) CastToBytes(b []DayTimeInterval) []byte {
	h := (*reflect.SliceHeader)(unsafe.Pointer(&b))

	var res []byte
	s := (*reflect.SliceHeader)(unsafe.Pointer(&res))
	s.Data = h.Data
	s.Len = h.Len * DayTimeIntervalSizeBytes
	s.Cap = h.Cap * DayTimeIntervalSizeBytes

	return res
}

// Copy copies src to dst.
func (daytimeTraits) Copy(dst, src []DayTimeInterval) { copy(dst, src) }
