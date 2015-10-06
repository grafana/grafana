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
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"strings"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

var currentRoot, _ = os.Getwd()

func Test_Static(t *testing.T) {
	Convey("Serve static files", t, func() {
		m := New()
		m.Use(Static("./"))

		resp := httptest.NewRecorder()
		resp.Body = new(bytes.Buffer)
		req, err := http.NewRequest("GET", "http://localhost:4000/macaron.go", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get("Expires"), ShouldBeBlank)
		So(resp.Body.Len(), ShouldBeGreaterThan, 0)

		Convey("Change static path", func() {
			m.Get("/", func(ctx *Context) {
				ctx.ChangeStaticPath("./", "inject")
			})

			resp := httptest.NewRecorder()
			req, err := http.NewRequest("GET", "/", nil)
			So(err, ShouldBeNil)
			m.ServeHTTP(resp, req)

			resp = httptest.NewRecorder()
			resp.Body = new(bytes.Buffer)
			req, err = http.NewRequest("GET", "http://localhost:4000/inject.go", nil)
			So(err, ShouldBeNil)
			m.ServeHTTP(resp, req)
			So(resp.Code, ShouldEqual, http.StatusOK)
			So(resp.Header().Get("Expires"), ShouldBeBlank)
			So(resp.Body.Len(), ShouldBeGreaterThan, 0)
		})
	})

	Convey("Serve static files with local path", t, func() {
		Root = os.TempDir()
		f, err := ioutil.TempFile(Root, "static_content")
		So(err, ShouldBeNil)
		f.WriteString("Expected Content")
		f.Close()

		m := New()
		m.Use(Static("."))

		resp := httptest.NewRecorder()
		resp.Body = new(bytes.Buffer)
		req, err := http.NewRequest("GET", "http://localhost:4000/"+path.Base(strings.Replace(f.Name(), "\\", "/", -1)), nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get("Expires"), ShouldBeBlank)
		So(resp.Body.String(), ShouldEqual, "Expected Content")
	})

	Convey("Serve static files with head", t, func() {
		m := New()
		m.Use(Static(currentRoot))

		resp := httptest.NewRecorder()
		resp.Body = new(bytes.Buffer)
		req, err := http.NewRequest("HEAD", "http://localhost:4000/macaron.go", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Body.Len(), ShouldEqual, 0)
	})

	Convey("Serve static files as post", t, func() {
		m := New()
		m.Use(Static(currentRoot))

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("POST", "http://localhost:4000/macaron.go", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Code, ShouldEqual, http.StatusNotFound)
	})

	Convey("Serve static files with bad directory", t, func() {
		m := Classic()
		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "http://localhost:4000/macaron.go", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Code, ShouldNotEqual, http.StatusOK)
	})
}

func Test_Static_Options(t *testing.T) {
	Convey("Serve static files with options logging", t, func() {
		var buf bytes.Buffer
		m := NewWithLogger(&buf)
		opt := StaticOptions{}
		m.Use(Static(currentRoot, opt))

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "http://localhost:4000/macaron.go", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(buf.String(), ShouldEqual, "[Macaron] [Static] Serving /macaron.go\n")

		// Not disable logging.
		m.Handlers()
		buf.Reset()
		opt.SkipLogging = true
		m.Use(Static(currentRoot, opt))
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(buf.Len(), ShouldEqual, 0)
	})

	Convey("Serve static files with options serve index", t, func() {
		var buf bytes.Buffer
		m := NewWithLogger(&buf)
		opt := StaticOptions{IndexFile: "macaron.go"}
		m.Use(Static(currentRoot, opt))

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "http://localhost:4000/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(buf.String(), ShouldEqual, "[Macaron] [Static] Serving /macaron.go\n")
	})

	Convey("Serve static files with options prefix", t, func() {
		var buf bytes.Buffer
		m := NewWithLogger(&buf)
		opt := StaticOptions{Prefix: "public"}
		m.Use(Static(currentRoot, opt))

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "http://localhost:4000/public/macaron.go", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(buf.String(), ShouldEqual, "[Macaron] [Static] Serving /macaron.go\n")
	})

	Convey("Serve static files with options expires", t, func() {
		var buf bytes.Buffer
		m := NewWithLogger(&buf)
		opt := StaticOptions{Expires: func() string { return "46" }}
		m.Use(Static(currentRoot, opt))

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "http://localhost:4000/macaron.go", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Header().Get("Expires"), ShouldEqual, "46")
	})
}

func Test_Static_Redirect(t *testing.T) {
	Convey("Serve static files with redirect", t, func() {
		m := New()
		m.Use(Static(currentRoot, StaticOptions{Prefix: "/public"}))

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "http://localhost:4000/public", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusFound)
		So(resp.Header().Get("Location"), ShouldEqual, "/public/")
	})
}

func Test_Statics(t *testing.T) {
	Convey("Serve multiple static routers", t, func() {
		Convey("Register empty directory", func() {
			defer func() {
				So(recover(), ShouldNotBeNil)
			}()

			m := New()
			m.Use(Statics(StaticOptions{}))

			resp := httptest.NewRecorder()
			req, err := http.NewRequest("GET", "http://localhost:4000/", nil)
			So(err, ShouldBeNil)
			m.ServeHTTP(resp, req)
		})

		Convey("Serve normally", func() {
			var buf bytes.Buffer
			m := NewWithLogger(&buf)
			m.Use(Statics(StaticOptions{}, currentRoot, currentRoot+"/inject"))

			resp := httptest.NewRecorder()
			req, err := http.NewRequest("GET", "http://localhost:4000/macaron.go", nil)
			So(err, ShouldBeNil)
			m.ServeHTTP(resp, req)

			So(resp.Code, ShouldEqual, http.StatusOK)
			So(buf.String(), ShouldEqual, "[Macaron] [Static] Serving /macaron.go\n")

			resp = httptest.NewRecorder()
			req, err = http.NewRequest("GET", "http://localhost:4000/inject/inject.go", nil)
			So(err, ShouldBeNil)
			m.ServeHTTP(resp, req)

			So(resp.Code, ShouldEqual, http.StatusOK)
			So(buf.String(), ShouldEndWith, "[Macaron] [Static] Serving /inject/inject.go\n")
		})
	})
}
