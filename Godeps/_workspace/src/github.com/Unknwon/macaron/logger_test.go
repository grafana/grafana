// Copyright 2013 Martini Authors
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

package macaron

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Unknwon/com"

	. "github.com/smartystreets/goconvey/convey"
)

func Test_Logger(t *testing.T) {
	Convey("Global logger", t, func() {
		buf := bytes.NewBufferString("")
		m := New()
		m.Map(log.New(buf, "[Macaron] ", 0))
		m.Use(Logger())
		m.Use(func(res http.ResponseWriter) {
			res.WriteHeader(http.StatusNotFound)
		})
		m.Get("/", func() {})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "http://localhost:4000/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Code, ShouldEqual, http.StatusNotFound)
		So(len(buf.String()), ShouldBeGreaterThan, 0)
	})

	if ColorLog {
		Convey("Color console output", t, func() {
			m := Classic()
			m.Get("/:code:int", func(ctx *Context) (int, string) {
				return ctx.ParamsInt(":code"), ""
			})

			// Just for testing if logger would capture.
			codes := []int{200, 201, 202, 301, 302, 304, 401, 403, 404, 500}
			for _, code := range codes {
				resp := httptest.NewRecorder()
				req, err := http.NewRequest("GET", "http://localhost:4000/"+com.ToStr(code), nil)
				So(err, ShouldBeNil)
				m.ServeHTTP(resp, req)
				So(resp.Code, ShouldEqual, code)
			}
		})
	}
}
