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

	"github.com/macaron-contrib/session"
)

func Test_MysqlProvider(t *testing.T) {
	Convey("Test mysql session provider", t, func() {
		opt := session.Options{
			Provider:       "mysql",
			ProviderConfig: "root:@tcp(localhost:3306)/macaron?charset=utf8",
		}

		Convey("Basic operation", func() {
			m := macaron.New()
			m.Use(session.Sessioner(opt))

			m.Get("/", func(ctx *macaron.Context, sess session.Store) {
				sess.Set("uname", "unknwon")
			})
			m.Get("/reg", func(ctx *macaron.Context, sess session.Store) {
				raw, err := sess.RegenerateId(ctx)
				So(err, ShouldBeNil)
				So(raw, ShouldNotBeNil)

				uname := raw.Get("uname")
				So(uname, ShouldNotBeNil)
				So(uname, ShouldEqual, "unknwon")
			})
			m.Get("/get", func(ctx *macaron.Context, sess session.Store) {
				sid := sess.ID()
				So(sid, ShouldNotBeEmpty)

				raw, err := sess.Read(sid)
				So(err, ShouldBeNil)
				So(raw, ShouldNotBeNil)
				So(raw.Release(), ShouldBeNil)

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
			m.Use(session.Sessioner(opt))
			m.Get("/", func(ctx *macaron.Context, sess session.Store) {
				raw, err := sess.RegenerateId(ctx)
				So(err, ShouldBeNil)
				So(raw, ShouldNotBeNil)

				So(sess.Destory(ctx), ShouldBeNil)
			})

			resp := httptest.NewRecorder()
			req, err := http.NewRequest("GET", "/", nil)
			So(err, ShouldBeNil)
			req.Header.Set("Cookie", "MacaronSession=ad2c7e3cbecfcf48; Path=/;")
			m.ServeHTTP(resp, req)
		})

		Convey("GC session", func() {
			m := macaron.New()
			opt2 := opt
			opt2.Gclifetime = 1
			m.Use(session.Sessioner(opt2))

			m.Get("/", func(sess session.Store) {
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
	})
}
