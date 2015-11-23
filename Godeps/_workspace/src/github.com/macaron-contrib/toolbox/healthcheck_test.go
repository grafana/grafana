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

package toolbox

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Unknwon/macaron"
	. "github.com/smartystreets/goconvey/convey"
)

type dummyChecker struct {
}

func (dc *dummyChecker) Desc() string {
	return "Dummy checker"
}

func (dc *dummyChecker) Check() error {
	return nil
}

type dummyChecker2 struct {
}

func (dc *dummyChecker2) Desc() string {
	return "Dummy checker error"
}

func (dc *dummyChecker2) Check() error {
	return errors.New("Wow, error!")
}

func TestHealthCheck(t *testing.T) {
	Convey("No health check job", t, func() {
		resp := httptest.NewRecorder()
		resp.Body = new(bytes.Buffer)

		m := macaron.New()
		m.Use(Toolboxer(m))

		req, err := http.NewRequest("GET", "http://localhost:4000/healthcheck", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Body.String(), ShouldEqual, "no health check jobs")
	})

	Convey("Health check without error", t, func() {
		resp := httptest.NewRecorder()
		resp.Body = new(bytes.Buffer)

		m := macaron.New()

		m.Use(Toolboxer(m, Options{
			HealthCheckers: []HealthChecker{
				new(dummyChecker),
			},
			HealthCheckFuncs: []*HealthCheckFuncDesc{
				&HealthCheckFuncDesc{
					Desc: "Dummy check",
					Func: func() error { return nil },
				},
			},
		}))

		req, err := http.NewRequest("GET", "http://localhost:4000/healthcheck", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Body.String(), ShouldEqual, "* Dummy checker: OK\n* Dummy check: OK\n")
	})

	Convey("Health check with error", t, func() {
		resp := httptest.NewRecorder()
		resp.Body = new(bytes.Buffer)

		m := macaron.New()
		m.Use(Toolboxer(m, Options{
			HealthCheckers: []HealthChecker{
				new(dummyChecker2),
			},
			HealthCheckFuncs: []*HealthCheckFuncDesc{
				&HealthCheckFuncDesc{
					Desc: "Dummy error",
					Func: func() error { return errors.New("Hello error!") },
				},
			},
		}))

		req, err := http.NewRequest("GET", "http://localhost:4000/healthcheck", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Body.String(), ShouldEqual, "* Dummy checker error: Wow, error!\n* Dummy error: Hello error!\n")
	})
}
