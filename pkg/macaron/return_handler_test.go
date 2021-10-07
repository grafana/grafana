// Copyright 2014 The Macaron Authors
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
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

type r1Invoker func() (int, string)

func (l r1Invoker) Invoke(p []interface{}) ([]reflect.Value, error) {
	ret, str := l()
	return []reflect.Value{reflect.ValueOf(ret), reflect.ValueOf(str)}, nil
}

func Test_Return_Handler(t *testing.T) {
	Convey("Return with status and body", t, func() {
		m := New()
		m.Get("/", func() (int, string) {
			return 418, "i'm a teapot"
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusTeapot)
		So(resp.Body.String(), ShouldEqual, "i'm a teapot")
	})

	Convey("Return with status and body-FastInvoke", t, func() {
		m := New()
		m.Get("/", r1Invoker(func() (int, string) {
			return 418, "i'm a teapot"
		}))

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusTeapot)
		So(resp.Body.String(), ShouldEqual, "i'm a teapot")
	})

	Convey("Return with error", t, func() {
		m := New()
		m.Get("/", func() error {
			return errors.New("what the hell!!!")
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusInternalServerError)
		So(resp.Body.String(), ShouldEqual, "what the hell!!!\n")

		Convey("Return with nil error", func() {
			m := New()
			m.Get("/", func() error {
				return nil
			}, func() (int, string) {
				return 200, "Awesome"
			})

			resp := httptest.NewRecorder()
			req, err := http.NewRequest("GET", "/", nil)
			So(err, ShouldBeNil)
			m.ServeHTTP(resp, req)

			So(resp.Code, ShouldEqual, http.StatusOK)
			So(resp.Body.String(), ShouldEqual, "Awesome")
		})
	})

	Convey("Return with pointer", t, func() {
		m := New()
		m.Get("/", func() *string {
			str := "hello world"
			return &str
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Body.String(), ShouldEqual, "hello world")
	})

	Convey("Return with byte slice", t, func() {
		m := New()
		m.Get("/", func() []byte {
			return []byte("hello world")
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Body.String(), ShouldEqual, "hello world")
	})
}
