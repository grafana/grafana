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

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	cw "github.com/weaveworks/common/middleware"
	"gopkg.in/macaron.v1"
)

func Logger(cfg *setting.Cfg) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			c := macaron.FromContext(req.Context())
			start := time.Now()
			c.Data["perfmon.start"] = start

			next.ServeHTTP(res, req)

			timeTaken := time.Since(start) / time.Millisecond

			if timer, ok := c.Data["perfmon.timer"]; ok {
				timerTyped := timer.(prometheus.Summary)
				timerTyped.Observe(float64(timeTaken))
			}

			rw := res.(macaron.ResponseWriter)
			status := rw.Status()
			if !cfg.RouterLogging && (status == 200 || status == 304) {
				return
			}

			ctx, ok := c.Data["ctx"]
			if !ok {
				return
			}
			ctxTyped := ctx.(*models.ReqContext)

			logParams := []interface{}{
				"method", req.Method,
				"path", req.URL.Path,
				"status", status,
				"remote_addr", c.RemoteAddr(),
				"time_ms", int64(timeTaken),
				"size", rw.Size(),
				"referer", req.Referer(),
			}

			if traceID, exist := cw.ExtractTraceID(ctxTyped.Req.Request.Context()); exist {
				logParams = append(logParams, "traceID", traceID)
			}

			if status >= 500 {
				ctxTyped.Logger.Error("Request Completed", logParams...)
			} else {
				ctxTyped.Logger.Info("Request Completed", logParams...)
			}
		})
	}
}
