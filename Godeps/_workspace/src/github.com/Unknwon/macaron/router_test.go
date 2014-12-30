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
	"net/http"
	"net/http/httptest"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func Test_Router_Handle(t *testing.T) {
	Convey("Register all HTTP methods routes", t, func() {
		m := Classic()
		m.Get("/get", func() string {
			return "GET"
		})
		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/get", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "GET")

		m.Patch("/patch", func() string {
			return "PATCH"
		})
		resp = httptest.NewRecorder()
		req, err = http.NewRequest("PATCH", "/patch", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "PATCH")

		m.Post("/post", func() string {
			return "POST"
		})
		resp = httptest.NewRecorder()
		req, err = http.NewRequest("POST", "/post", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "POST")

		m.Put("/put", func() string {
			return "PUT"
		})
		resp = httptest.NewRecorder()
		req, err = http.NewRequest("PUT", "/put", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "PUT")

		m.Delete("/delete", func() string {
			return "DELETE"
		})
		resp = httptest.NewRecorder()
		req, err = http.NewRequest("DELETE", "/delete", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "DELETE")

		m.Options("/options", func() string {
			return "OPTIONS"
		})
		resp = httptest.NewRecorder()
		req, err = http.NewRequest("OPTIONS", "/options", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "OPTIONS")

		m.Head("/head", func() string {
			return "HEAD"
		})
		resp = httptest.NewRecorder()
		req, err = http.NewRequest("HEAD", "/head", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "HEAD")

		m.Any("/any", func() string {
			return "ANY"
		})
		resp = httptest.NewRecorder()
		req, err = http.NewRequest("GET", "/any", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "ANY")

		m.Route("/route", "GET,POST", func() string {
			return "ROUTE"
		})
		resp = httptest.NewRecorder()
		req, err = http.NewRequest("POST", "/route", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "ROUTE")
	})

	Convey("Register all HTTP methods routes with combo", t, func() {
		m := Classic()
		m.SetURLPrefix("/prefix")
		m.Use(Renderer())
		m.Combo("/", func(ctx *Context) {
			ctx.Data["prefix"] = "Prefix_"
		}).
			Get(func(ctx *Context) string { return ctx.Data["prefix"].(string) + "GET" }).
			Patch(func(ctx *Context) string { return ctx.Data["prefix"].(string) + "PATCH" }).
			Post(func(ctx *Context) string { return ctx.Data["prefix"].(string) + "POST" }).
			Put(func(ctx *Context) string { return ctx.Data["prefix"].(string) + "PUT" }).
			Delete(func(ctx *Context) string { return ctx.Data["prefix"].(string) + "DELETE" }).
			Options(func(ctx *Context) string { return ctx.Data["prefix"].(string) + "OPTIONS" }).
			Head(func(ctx *Context) string { return ctx.Data["prefix"].(string) + "HEAD" })

		for name := range _HTTP_METHODS {
			resp := httptest.NewRecorder()
			req, err := http.NewRequest(name, "/", nil)
			So(err, ShouldBeNil)
			m.ServeHTTP(resp, req)
			So(resp.Body.String(), ShouldEqual, "Prefix_"+name)
		}

		defer func() {
			So(recover(), ShouldNotBeNil)
		}()
		m.Combo("/").Get(func() {}).Get(nil)
	})

	Convey("Register duplicated routes", t, func() {
		r := NewRouter()
		r.Get("/")
		r.Get("/")
	})

	Convey("Register invalid HTTP method", t, func() {
		defer func() {
			So(recover(), ShouldNotBeNil)
		}()
		r := NewRouter()
		r.Handle("404", "/", nil)
	})
}

func Test_Router_Group(t *testing.T) {
	Convey("Register route group", t, func() {
		m := Classic()
		m.Group("/api", func() {
			m.Group("/v1", func() {
				m.Get("/list", func() string {
					return "Well done!"
				})
			})
		})
		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/api/v1/list", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "Well done!")
	})
}

func Test_Router_NotFound(t *testing.T) {
	Convey("Custom not found handler", t, func() {
		m := Classic()
		m.Get("/", func() {})
		m.NotFound(func() string {
			return "Custom not found"
		})
		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/404", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "Custom not found")
	})
}

func Test_Router_splat(t *testing.T) {
	Convey("Register router with glob", t, func() {
		m := Classic()
		m.Get("/*", func(ctx *Context) string {
			return ctx.Params("*")
		})
		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/hahaha", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "hahaha")
	})
}
