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
	"bufio"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"
)

type closeNotifyingRecorder struct {
	*httptest.ResponseRecorder
	closed chan bool
}

func newCloseNotifyingRecorder() *closeNotifyingRecorder {
	return &closeNotifyingRecorder{
		httptest.NewRecorder(),
		make(chan bool, 1),
	}
}

func (c *closeNotifyingRecorder) close() {
	c.closed <- true
}

func (c *closeNotifyingRecorder) CloseNotify() <-chan bool {
	return c.closed
}

type hijackableResponse struct {
	Hijacked bool
}

func newHijackableResponse() *hijackableResponse {
	return &hijackableResponse{}
}

func (h *hijackableResponse) Header() http.Header           { return nil }
func (h *hijackableResponse) Write(buf []byte) (int, error) { return 0, nil }
func (h *hijackableResponse) WriteHeader(code int)          {}
func (h *hijackableResponse) Flush()                        {}
func (h *hijackableResponse) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h.Hijacked = true
	return nil, nil, nil
}

func Test_ResponseWriter(t *testing.T) {
	Convey("Write string to response writer", t, func() {
		resp := httptest.NewRecorder()
		rw := NewResponseWriter(resp)
		rw.Write([]byte("Hello world"))

		So(resp.Code, ShouldEqual, rw.Status())
		So(resp.Body.String(), ShouldEqual, "Hello world")
		So(rw.Status(), ShouldEqual, http.StatusOK)
		So(rw.Size(), ShouldEqual, 11)
		So(rw.Written(), ShouldBeTrue)
	})

	Convey("Write strings to response writer", t, func() {
		resp := httptest.NewRecorder()
		rw := NewResponseWriter(resp)
		rw.Write([]byte("Hello world"))
		rw.Write([]byte("foo bar bat baz"))

		So(resp.Code, ShouldEqual, rw.Status())
		So(resp.Body.String(), ShouldEqual, "Hello worldfoo bar bat baz")
		So(rw.Status(), ShouldEqual, http.StatusOK)
		So(rw.Size(), ShouldEqual, 26)
		So(rw.Written(), ShouldBeTrue)
	})

	Convey("Write header to response writer", t, func() {
		resp := httptest.NewRecorder()
		rw := NewResponseWriter(resp)
		rw.WriteHeader(http.StatusNotFound)

		So(resp.Code, ShouldEqual, rw.Status())
		So(resp.Body.String(), ShouldBeBlank)
		So(rw.Status(), ShouldEqual, http.StatusNotFound)
		So(rw.Size(), ShouldEqual, 0)
	})

	Convey("Write before response write", t, func() {
		result := ""
		resp := httptest.NewRecorder()
		rw := NewResponseWriter(resp)
		rw.Before(func(ResponseWriter) {
			result += "foo"
		})
		rw.Before(func(ResponseWriter) {
			result += "bar"
		})
		rw.WriteHeader(http.StatusNotFound)

		So(resp.Code, ShouldEqual, rw.Status())
		So(resp.Body.String(), ShouldBeBlank)
		So(rw.Status(), ShouldEqual, http.StatusNotFound)
		So(rw.Size(), ShouldEqual, 0)
		So(result, ShouldEqual, "barfoo")
	})

	Convey("Response writer with Hijack", t, func() {
		hijackable := newHijackableResponse()
		rw := NewResponseWriter(hijackable)
		hijacker, ok := rw.(http.Hijacker)
		So(ok, ShouldBeTrue)
		_, _, err := hijacker.Hijack()
		So(err, ShouldBeNil)
		So(hijackable.Hijacked, ShouldBeTrue)
	})

	Convey("Response writer with bad Hijack", t, func() {
		hijackable := new(http.ResponseWriter)
		rw := NewResponseWriter(*hijackable)
		hijacker, ok := rw.(http.Hijacker)
		So(ok, ShouldBeTrue)
		_, _, err := hijacker.Hijack()
		So(err, ShouldNotBeNil)
	})

	Convey("Response writer with close notify", t, func() {
		resp := newCloseNotifyingRecorder()
		rw := NewResponseWriter(resp)
		closed := false
		notifier := rw.(http.CloseNotifier).CloseNotify()
		resp.close()
		select {
		case <-notifier:
			closed = true
		case <-time.After(time.Second):
		}
		So(closed, ShouldBeTrue)
	})

	Convey("Response writer with flusher", t, func() {
		resp := httptest.NewRecorder()
		rw := NewResponseWriter(resp)
		_, ok := rw.(http.Flusher)
		So(ok, ShouldBeTrue)
	})

	Convey("Response writer with flusher handler", t, func() {
		m := Classic()
		m.Get("/events", func(w http.ResponseWriter, r *http.Request) {
			f, ok := w.(http.Flusher)
			So(ok, ShouldBeTrue)

			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")

			for i := 0; i < 2; i++ {
				time.Sleep(10 * time.Millisecond)
				io.WriteString(w, "data: Hello\n\n")
				f.Flush()
			}
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/events", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Body.String(), ShouldEqual, "data: Hello\n\ndata: Hello\n\n")
	})
}
