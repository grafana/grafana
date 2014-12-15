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
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func Test_Gzip(t *testing.T) {
	Convey("Gzip response content", t, func() {
		before := false

		m := New()
		m.Use(Gziper())
		m.Use(func(r http.ResponseWriter) {
			r.(ResponseWriter).Before(func(rw ResponseWriter) {
				before = true
			})
		})
		m.Get("/", func() string { return "hello wolrd!" })

		// Not yet gzip.
		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		_, ok := resp.HeaderMap[HeaderContentEncoding]
		So(ok, ShouldBeFalse)

		ce := resp.Header().Get(HeaderContentEncoding)
		So(strings.EqualFold(ce, "gzip"), ShouldBeFalse)

		// Gzip now.
		resp = httptest.NewRecorder()
		req.Header.Set(HeaderAcceptEncoding, "gzip")
		m.ServeHTTP(resp, req)

		_, ok = resp.HeaderMap[HeaderContentEncoding]
		So(ok, ShouldBeTrue)

		ce = resp.Header().Get(HeaderContentEncoding)
		So(strings.EqualFold(ce, "gzip"), ShouldBeTrue)

		So(before, ShouldBeTrue)
	})
}
