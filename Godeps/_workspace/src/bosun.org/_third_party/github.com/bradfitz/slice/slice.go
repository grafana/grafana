// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package slice provides a slice sorting function.
//
// It uses gross, low-level operations to make it easy to sort
// arbitrary slices with only a less function, without defining a new
// type with Len and Swap operations.
package slice

import (
	"fmt"
	"reflect"
	"sort"
	"unsafe"
)

const useReflectSwap = false

const ptrSize = unsafe.Sizeof((*int)(nil))

// Sort sorts the provided slice using the function less.
// If slice is not a slice, Sort panics.
func Sort(slice interface{}, less func(i, j int) bool) {
	sort.Sort(SortInterface(slice, less))
}

// SortInterface returns a sort.Interface to sort the provided slice
// using the function less.
func SortInterface(slice interface{}, less func(i, j int) bool) sort.Interface {
	sv := reflect.ValueOf(slice)
	if sv.Kind() != reflect.Slice {
		panic(fmt.Sprintf("slice.Sort called with non-slice value of type %T", slice))
	}

	size := sv.Type().Elem().Size()
	ss := &lenLesser{
		less:  less,
		slice: sv,
		size:  size,
		len:   sv.Len(),
	}

	var baseMem unsafe.Pointer
	if ss.len > 0 {
		baseMem = unsafe.Pointer(sv.Index(0).Addr().Pointer())
	}

	switch {
	case useReflectSwap:
		return &reflectSwap{
			temp:      reflect.New(sv.Type().Elem()).Elem(),
			lenLesser: ss,
		}
	case uintptr(size) == ptrSize:
		return &pointerSwap{
			baseMem:   baseMem,
			lenLesser: ss,
		}
	case size == 8:
		return &swap8{
			baseMem:   baseMem,
			lenLesser: ss,
		}
	case size == 4:
		return &swap4{
			baseMem:   baseMem,
			lenLesser: ss,
		}
	default:
		// Make a properly-typed (for GC) chunk of memory for swap
		// operations.
		temp := reflect.New(sv.Type().Elem()).Elem()
		tempMem := unsafe.Pointer(temp.Addr().Pointer())
		ms := newMemSwap(size, baseMem, tempMem)
		ms.lenLesser = ss
		return ms
	}
}

func newMemSwap(size uintptr, baseMem, tempMem unsafe.Pointer) *memSwap {
	tempSlice := *(*[]byte)(unsafe.Pointer(&reflect.SliceHeader{
		Data: uintptr(tempMem),
		Len:  int(size),
		Cap:  int(size),
	}))
	ms := &memSwap{
		imem: *(*[]byte)(unsafe.Pointer(&reflect.SliceHeader{Data: uintptr(baseMem), Len: int(size), Cap: int(size)})),
		jmem: *(*[]byte)(unsafe.Pointer(&reflect.SliceHeader{Data: uintptr(baseMem), Len: int(size), Cap: int(size)})),
		temp: tempSlice,
		size: size,
		base: baseMem,
	}
	ms.ibase = (*uintptr)(unsafe.Pointer(&ms.imem))
	ms.jbase = (*uintptr)(unsafe.Pointer(&ms.jmem))
	return ms
}

type lenLesser struct {
	less  func(i, j int) bool
	slice reflect.Value
	len   int
	size  uintptr
}

func (s *lenLesser) Len() int { return s.len }

func (s *lenLesser) Less(i, j int) bool {
	return s.less(i, j)
}

// reflectSwap is the pure reflect-based swap. It's compiled out by
// default because it's ridiculously slow. But it's kept here in case
// you want to see for yourself.
type reflectSwap struct {
	temp reflect.Value
	*lenLesser
}

func (s *reflectSwap) Swap(i, j int) {
	s.temp.Set(s.slice.Index(i))
	s.slice.Index(i).Set(s.slice.Index(j))
	s.slice.Index(j).Set(s.temp)
}

// pointerSwap swaps pointers.
type pointerSwap struct {
	baseMem unsafe.Pointer
	*lenLesser
}

func (s *pointerSwap) Swap(i, j int) {
	base := s.baseMem
	ip := (*unsafe.Pointer)(unsafe.Pointer(uintptr(base) + uintptr(i)*ptrSize))
	jp := (*unsafe.Pointer)(unsafe.Pointer(uintptr(base) + uintptr(j)*ptrSize))
	*ip, *jp = *jp, *ip
}

// swap8 swaps 8-byte non-pointer elements.
type swap8 struct {
	baseMem unsafe.Pointer
	*lenLesser
}

func (s *swap8) Swap(i, j int) {
	base := s.baseMem
	ip := (*uint64)(unsafe.Pointer(uintptr(base) + uintptr(i)*8))
	jp := (*uint64)(unsafe.Pointer(uintptr(base) + uintptr(j)*8))
	*ip, *jp = *jp, *ip
}

// swap4 swaps 4-byte non-pointer elements.
type swap4 struct {
	baseMem unsafe.Pointer
	*lenLesser
}

func (s *swap4) Swap(i, j int) {
	base := s.baseMem
	ip := (*uint32)(unsafe.Pointer(uintptr(base) + uintptr(i)*4))
	jp := (*uint32)(unsafe.Pointer(uintptr(base) + uintptr(j)*4))
	*ip, *jp = *jp, *ip
}

// memSwap swaps regions of memory
type memSwap struct {
	imem  []byte
	jmem  []byte
	temp  []byte   // properly typed slice of memory to use as temp space
	ibase *uintptr // ibase points to the Data word of imem
	jbase *uintptr // jbase points to the Data word of jmem
	size  uintptr
	base  unsafe.Pointer
	*lenLesser
}

func (s *memSwap) Swap(i, j int) {
	imem, jmem, temp := s.imem, s.jmem, s.temp
	base, size := s.base, s.size
	*(*uintptr)(unsafe.Pointer(&imem)) = uintptr(base) + size*uintptr(i)
	*(*uintptr)(unsafe.Pointer(&jmem)) = uintptr(base) + size*uintptr(j)
	copy(temp, imem)
	copy(imem, jmem)
	copy(jmem, temp)
}
