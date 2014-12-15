// Copyright 2013 Beego Authors
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
	"strings"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestMem(t *testing.T) {
	Convey("Memory provider", t, func() {
		config := &Config{
			CookieName: "gosessionid",
			Gclifetime: 10,
		}
		globalSessions, err := NewManager("memory", config)
		So(err, ShouldBeNil)
		go globalSessions.GC()

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)

		sess, err := globalSessions.SessionStart(resp, req)
		if err != nil {
			t.Fatal("start session,", err)
		}
		defer sess.SessionRelease(resp)

		So(sess.Set("username", "Unknwon"), ShouldBeNil)
		So(sess.Get("username"), ShouldEqual, "Unknwon")

		cookiestr := resp.Header().Get("Set-Cookie")
		So(cookiestr, ShouldNotBeEmpty)
		parts := strings.Split(strings.TrimSpace(cookiestr), ";")
		for _, v := range parts {
			nameval := strings.Split(v, "=")
			So(nameval[0], ShouldEqual, "gosessionid")
			break
		}
	})
}
