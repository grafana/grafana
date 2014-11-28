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
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestIsFile(t *testing.T) {
	if !IsFile("file.go") {
		t.Errorf("IsExist:\n Expect => %v\n Got => %v\n", true, false)
	}

	if IsFile("testdata") {
		t.Errorf("IsExist:\n Expect => %v\n Got => %v\n", false, true)
	}

	if IsFile("files.go") {
		t.Errorf("IsExist:\n Expect => %v\n Got => %v\n", false, true)
	}
}

func TestIsExist(t *testing.T) {
	Convey("Check if file or directory exists", t, func() {
		Convey("Pass a file name that exists", func() {
			So(IsExist("file.go"), ShouldEqual, true)
		})
		Convey("Pass a directory name that exists", func() {
			So(IsExist("testdata"), ShouldEqual, true)
		})
		Convey("Pass a directory name that does not exist", func() {
			So(IsExist(".hg"), ShouldEqual, false)
		})
	})
}

func BenchmarkIsFile(b *testing.B) {
	for i := 0; i < b.N; i++ {
		IsFile("file.go")
	}
}

func BenchmarkIsExist(b *testing.B) {
	for i := 0; i < b.N; i++ {
		IsExist("file.go")
	}
}
