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

package middleware

import (
	"net/http"
	"time"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"gopkg.in/macaron.v1"
)

func Logger() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		start := time.Now()
		c.Data["perfmon.start"] = start

		rw := res.(macaron.ResponseWriter)
		c.Next()

		timeTakenMs := time.Since(start) / time.Millisecond

		if timer, ok := c.Data["perfmon.timer"]; ok {
			timerTyped := timer.(prometheus.Summary)
			timerTyped.Observe(float64(timeTakenMs))
		}

		status := rw.Status()
		if status == 200 || status == 304 {
			if !setting.RouterLogging {
				return
			}
		}

		if ctx, ok := c.Data["ctx"]; ok {
			ctxTyped := ctx.(*m.ReqContext)
			if status == 500 {
				ctxTyped.Logger.Error("Request Completed", "method", req.Method, "path", req.URL.Path, "status", status, "remote_addr", c.RemoteAddr(), "time_ms", int64(timeTakenMs), "size", rw.Size(), "referer", req.Referer())
			} else {
				ctxTyped.Logger.Info("Request Completed", "method", req.Method, "path", req.URL.Path, "status", status, "remote_addr", c.RemoteAddr(), "time_ms", int64(timeTakenMs), "size", rw.Size(), "referer", req.Referer())
			}
		}
	}
}
