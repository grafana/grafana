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

package session

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Unknwon/macaron"
	. "github.com/smartystreets/goconvey/convey"
)

func Test_Version(t *testing.T) {
	Convey("Check package version", t, func() {
		So(Version(), ShouldEqual, _VERSION)
	})
}

func Test_Sessioner(t *testing.T) {
	Convey("Use session middleware", t, func() {
		m := macaron.New()
		m.Use(Sessioner())
		m.Get("/", func() {})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
	})

	Convey("Register invalid provider", t, func() {
		Convey("Provider not exists", func() {
			defer func() {
				So(recover(), ShouldNotBeNil)
			}()

			m := macaron.New()
			m.Use(Sessioner(Options{
				Provider: "fake",
			}))
		})

		Convey("Provider value is nil", func() {
			defer func() {
				So(recover(), ShouldNotBeNil)
			}()

			Register("fake", nil)
		})

		Convey("Register twice", func() {
			defer func() {
				So(recover(), ShouldNotBeNil)
			}()

			Register("memory", &MemProvider{})
		})
	})
}

func testProvider(opt Options) {
	Convey("Basic operation", func() {
		m := macaron.New()
		m.Use(Sessioner(opt))

		m.Get("/", func(ctx *macaron.Context, sess Store) {
			sess.Set("uname", "unknwon")
		})
		m.Get("/reg", func(ctx *macaron.Context, sess Store) {
			raw, err := sess.RegenerateId(ctx)
			So(err, ShouldBeNil)
			So(raw, ShouldNotBeNil)

			uname := raw.Get("uname")
			So(uname, ShouldNotBeNil)
			So(uname, ShouldEqual, "unknwon")
		})
		m.Get("/get", func(ctx *macaron.Context, sess Store) {
			sid := sess.ID()
			So(sid, ShouldNotBeEmpty)

			raw, err := sess.Read(sid)
			So(err, ShouldBeNil)
			So(raw, ShouldNotBeNil)

			uname := sess.Get("uname")
			So(uname, ShouldNotBeNil)
			So(uname, ShouldEqual, "unknwon")

			So(sess.Delete("uname"), ShouldBeNil)
			So(sess.Get("uname"), ShouldBeNil)

			So(sess.Destory(ctx), ShouldBeNil)
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		cookie := resp.Header().Get("Set-Cookie")

		resp = httptest.NewRecorder()
		req, err = http.NewRequest("GET", "/reg", nil)
		So(err, ShouldBeNil)
		req.Header.Set("Cookie", cookie)
		m.ServeHTTP(resp, req)

		cookie = resp.Header().Get("Set-Cookie")

		resp = httptest.NewRecorder()
		req, err = http.NewRequest("GET", "/get", nil)
		So(err, ShouldBeNil)
		req.Header.Set("Cookie", cookie)
		m.ServeHTTP(resp, req)
	})

	Convey("Regenrate empty session", func() {
		m := macaron.New()
		m.Use(Sessioner(opt))
		m.Get("/", func(ctx *macaron.Context, sess Store) {
			raw, err := sess.RegenerateId(ctx)
			So(err, ShouldBeNil)
			So(raw, ShouldNotBeNil)
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		req.Header.Set("Cookie", "MacaronSession=ad2c7e3cbecfcf486; Path=/;")
		m.ServeHTTP(resp, req)
	})

	Convey("GC session", func() {
		m := macaron.New()
		opt2 := opt
		opt2.Gclifetime = 1
		m.Use(Sessioner(opt2))

		m.Get("/", func(sess Store) {
			sess.Set("uname", "unknwon")
			So(sess.ID(), ShouldNotBeEmpty)
			uname := sess.Get("uname")
			So(uname, ShouldNotBeNil)
			So(uname, ShouldEqual, "unknwon")

			So(sess.Flush(), ShouldBeNil)
			So(sess.Get("uname"), ShouldBeNil)

			time.Sleep(2 * time.Second)
			sess.GC()
			So(sess.Count(), ShouldEqual, 0)
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
	})
}

func Test_Flash(t *testing.T) {
	Convey("Test flash", t, func() {
		m := macaron.New()
		m.Use(Sessioner())
		m.Get("/set", func(f *Flash) string {
			f.Success("success")
			f.Error("error")
			f.Warning("warning")
			f.Info("info")
			return ""
		})
		m.Get("/get", func() {})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/set", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		resp = httptest.NewRecorder()
		req, err = http.NewRequest("GET", "/get", nil)
		So(err, ShouldBeNil)
		req.Header.Set("Cookie", "macaron_flash=error%3Derror%26info%3Dinfo%26success%3Dsuccess%26warning%3Dwarning; Path=/")
		m.ServeHTTP(resp, req)
	})
}
