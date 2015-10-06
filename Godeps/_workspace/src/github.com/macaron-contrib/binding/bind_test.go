// Copyright 2014 martini-contrib/binding Authors
// Copyright 2014 Unknwon
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

package binding

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func Test_Bind(t *testing.T) {
	Convey("Bind test", t, func() {
		Convey("Bind form", func() {
			for _, testCase := range formTestCases {
				performFormTest(t, Bind, testCase)
			}
		})

		Convey("Bind JSON", func() {
			for _, testCase := range jsonTestCases {
				performJsonTest(t, Bind, testCase)
			}
		})

		Convey("Bind multipart form", func() {
			for _, testCase := range multipartFormTestCases {
				performMultipartFormTest(t, Bind, testCase)
			}
		})

		Convey("Bind with file", func() {
			for _, testCase := range fileTestCases {
				performFileTest(t, Bind, testCase)
				performFileTest(t, BindIgnErr, testCase)
			}
		})
	})
}

func Test_Version(t *testing.T) {
	Convey("Get package version", t, func() {
		So(Version(), ShouldEqual, _VERSION)
	})
}
