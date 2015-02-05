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
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Unknwon/macaron"
	. "github.com/smartystreets/goconvey/convey"
)

// When binding from Form data, testing the type of data to bind
// and converting a string into that type is tedious, so these tests
// cover all those cases.
func Test_SetWithProperType(t *testing.T) {
	Convey("Set with proper type", t, func() {
		testInputs := map[string]string{
			"successful": `integer=-1&integer8=-8&integer16=-16&integer32=-32&integer64=-64&uinteger=1&uinteger8=8&uinteger16=16&uinteger32=32&uinteger64=64&boolean_1=true&fl32_1=32.3232&fl64_1=-64.6464646464&str=string`,
			"errorful":   `integer=&integer8=asdf&integer16=--&integer32=&integer64=dsf&uinteger=&uinteger8=asdf&uinteger16=+&uinteger32= 32 &uinteger64=+%20+&boolean_1=&boolean_2=asdf&fl32_1=asdf&fl32_2=&fl64_1=&fl64_2=asdfstr`,
		}

		expectedOutputs := map[string]Everything{
			"successful": Everything{
				Integer:    -1,
				Integer8:   -8,
				Integer16:  -16,
				Integer32:  -32,
				Integer64:  -64,
				Uinteger:   1,
				Uinteger8:  8,
				Uinteger16: 16,
				Uinteger32: 32,
				Uinteger64: 64,
				Boolean_1:  true,
				Fl32_1:     32.3232,
				Fl64_1:     -64.6464646464,
				Str:        "string",
			},
			"errorful": Everything{},
		}

		for key, testCase := range testInputs {
			httpRecorder := httptest.NewRecorder()
			m := macaron.Classic()

			m.Post(testRoute, Form(Everything{}), func(actual Everything, errs Errors) {
				So(fmt.Sprintf("%+v", actual), ShouldEqual, fmt.Sprintf("%+v", expectedOutputs[key]))
			})
			req, err := http.NewRequest("POST", testRoute, strings.NewReader(testCase))
			if err != nil {
				panic(err)
			}
			req.Header.Set("Content-Type", formContentType)
			m.ServeHTTP(httpRecorder, req)
		}
	})
}

// Each binder middleware should assert that the struct passed in is not
// a pointer (to avoid race conditions)
func Test_EnsureNotPointer(t *testing.T) {
	Convey("Ensure field is not a pointer", t, func() {
		shouldPanic := func() {
			defer func() {
				So(recover(), ShouldNotBeNil)
			}()
			ensureNotPointer(&Post{})
		}

		shouldNotPanic := func() {
			defer func() {
				So(recover(), ShouldBeNil)
			}()
			ensureNotPointer(Post{})
		}

		shouldPanic()
		shouldNotPanic()
	})
}

// Used in testing setWithProperType; kind of clunky...
type Everything struct {
	Integer    int     `form:"integer"`
	Integer8   int8    `form:"integer8"`
	Integer16  int16   `form:"integer16"`
	Integer32  int32   `form:"integer32"`
	Integer64  int64   `form:"integer64"`
	Uinteger   uint    `form:"uinteger"`
	Uinteger8  uint8   `form:"uinteger8"`
	Uinteger16 uint16  `form:"uinteger16"`
	Uinteger32 uint32  `form:"uinteger32"`
	Uinteger64 uint64  `form:"uinteger64"`
	Boolean_1  bool    `form:"boolean_1"`
	Boolean_2  bool    `form:"boolean_2"`
	Fl32_1     float32 `form:"fl32_1"`
	Fl32_2     float32 `form:"fl32_2"`
	Fl64_1     float64 `form:"fl64_1"`
	Fl64_2     float64 `form:"fl64_2"`
	Str        string  `form:"str"`
}
