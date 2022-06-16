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
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func Logger(cfg *setting.Cfg) web.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *web.Context) {
		start := time.Now()

		rw := res.(web.ResponseWriter)
		c.Next()

		timeTaken := time.Since(start) / time.Millisecond
		duration := time.Since(start).String()
		ctx := contexthandler.FromContext(c.Req.Context())
		if ctx != nil && ctx.PerfmonTimer != nil {
			ctx.PerfmonTimer.Observe(float64(timeTaken))
		}

		status := rw.Status()
		if status == 200 || status == 304 {
			if !cfg.RouterLogging {
				return
			}
		}

		if ctx != nil {
			logParams := []interface{}{
				"method", req.Method,
				"path", req.URL.Path,
				"status", status,
				"remote_addr", c.RemoteAddr(),
				"time_ms", int64(timeTaken),
				"duration", duration,
				"size", rw.Size(),
				"referer", sanitizeURL(ctx, req.Referer()),
			}

			traceID := tracing.TraceIDFromContext(ctx.Req.Context(), false)
			if traceID != "" {
				logParams = append(logParams, "traceID", traceID)
			}

			if status >= 500 {
				ctx.Logger.Error("Request Completed", logParams...)
			} else {
				ctx.Logger.Info("Request Completed", logParams...)
			}
		}
	}
}

func sanitizeURL(ctx *models.ReqContext, s string) string {
	if s == "" {
		return s
	}

	u, err := url.ParseRequestURI(s)
	if err != nil {
		ctx.Logger.Warn("Received invalid referer in request headers, removed for log forgery prevention")
		return ""
	}
	return u.String()
}
