// Copyright 2013 com authors
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package com

import (
	"fmt"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestAppendStr(t *testing.T) {
	Convey("Append a string to a slice with no duplicates", t, func() {
		s := []string{"a"}

		Convey("Append a string that does not exist in slice", func() {
			s = AppendStr(s, "b")
			So(len(s), ShouldEqual, 2)
		})

		Convey("Append a string that does exist in slice", func() {
			s = AppendStr(s, "b")
			So(len(s), ShouldEqual, 2)
		})
	})
}

func TestCompareSliceStr(t *testing.T) {
	Convey("Compares two 'string' type slices with elements and order", t, func() {
		Convey("Compare two slices that do have same elements and order", func() {
			So(CompareSliceStr(
				[]string{"1", "2", "3"}, []string{"1", "2", "3"}), ShouldBeTrue)
		})

		Convey("Compare two slices that do have same elements but does not have same order", func() {
			So(!CompareSliceStr(
				[]string{"2", "1", "3"}, []string{"1", "2", "3"}), ShouldBeTrue)
		})

		Convey("Compare two slices that have different number of elements", func() {
			So(!CompareSliceStr(
				[]string{"2", "1"}, []string{"1", "2", "3"}), ShouldBeTrue)
		})
	})
}

func TestCompareSliceStrU(t *testing.T) {
	Convey("Compare two 'string' type slices with elements and ignore the order", t, func() {
		Convey("Compare two slices that do have same elements and order", func() {
			So(CompareSliceStrU(
				[]string{"1", "2", "3"}, []string{"1", "2", "3"}), ShouldBeTrue)
		})

		Convey("Compare two slices that do have same elements but does not have same order", func() {
			So(CompareSliceStrU(
				[]string{"2", "1", "3"}, []string{"1", "2", "3"}), ShouldBeTrue)
		})

		Convey("Compare two slices that have different number of elements", func() {
			So(!CompareSliceStrU(
				[]string{"2", "1"}, []string{"1", "2", "3"}), ShouldBeTrue)
		})
	})
}

func BenchmarkAppendStr(b *testing.B) {
	s := []string{"a"}
	for i := 0; i < b.N; i++ {
		s = AppendStr(s, fmt.Sprint(b.N%3))
	}
}

func BenchmarkCompareSliceStr(b *testing.B) {
	s1 := []string{"1", "2", "3"}
	s2 := []string{"1", "2", "3"}
	for i := 0; i < b.N; i++ {
		CompareSliceStr(s1, s2)
	}
}

func BenchmarkCompareSliceStrU(b *testing.B) {
	s1 := []string{"1", "4", "2", "3"}
	s2 := []string{"1", "2", "3", "4"}
	for i := 0; i < b.N; i++ {
		CompareSliceStrU(s1, s2)
	}
}
