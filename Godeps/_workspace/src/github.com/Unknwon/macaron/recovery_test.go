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

	. "github.com/smartystreets/goconvey/convey"
)

func Test_Recovery(t *testing.T) {
	Convey("Recovery from panic", t, func() {
		buf := bytes.NewBufferString("")
		setENV(DEV)

		m := New()
		m.Map(log.New(buf, "[Macaron] ", 0))
		m.Use(func(res http.ResponseWriter, req *http.Request) {
			res.Header().Set("Content-Type", "unpredictable")
		})
		m.Use(Recovery())
		m.Use(func(res http.ResponseWriter, req *http.Request) {
			panic("here is a panic!")
		})
		m.Get("/", func() {})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Code, ShouldEqual, http.StatusInternalServerError)
		So(resp.HeaderMap.Get("Content-Type"), ShouldEqual, "text/html")
		So(buf.String(), ShouldNotBeEmpty)
	})

	Convey("Revocery panic to another response writer", t, func() {
		resp := httptest.NewRecorder()
		resp2 := httptest.NewRecorder()
		setENV(DEV)

		m := New()
		m.Use(Recovery())
		m.Use(func(c *Context) {
			c.MapTo(resp2, (*http.ResponseWriter)(nil))
			panic("here is a panic!")
		})
		m.Get("/", func() {})

		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp2.Code, ShouldEqual, http.StatusInternalServerError)
		So(resp2.HeaderMap.Get("Content-Type"), ShouldEqual, "text/html")
		So(resp2.Body.Len(), ShouldBeGreaterThan, 0)
	})
}
