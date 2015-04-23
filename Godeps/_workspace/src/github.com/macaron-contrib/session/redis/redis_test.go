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

	"github.com/Unknwon/macaron"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/macaron-contrib/session"
)

func Test_RedisProvider(t *testing.T) {
	Convey("Test redis session provider", t, func() {
		opt := session.Options{
			Provider:       "redis",
			ProviderConfig: "addr=:6379",
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
			})

			resp := httptest.NewRecorder()
			req, err := http.NewRequest("GET", "/", nil)
			So(err, ShouldBeNil)
			req.Header.Set("Cookie", "MacaronSession=ad2c7e3cbecfcf486; Path=/;")
			m.ServeHTTP(resp, req)
		})
	})
}
