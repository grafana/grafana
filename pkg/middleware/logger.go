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

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func Logger(cfg *setting.Cfg) web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// we have to init the context with the counter here to update the request
			r = r.WithContext(log.InitCounter(r.Context()))

			rw := web.Rw(w, r)
			next.ServeHTTP(rw, r)

			timeTaken := time.Since(start) / time.Millisecond
			duration := time.Since(start).String()
			ctx := contexthandler.FromContext(r.Context())
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
					"method", r.Method,
					"path", r.URL.Path,
					"status", status,
					"remote_addr", ctx.RemoteAddr(),
					"time_ms", int64(timeTaken),
					"duration", duration,
					"size", rw.Size(),
					"referer", SanitizeURL(ctx, r.Referer()),
				}

				if cfg.IsFeatureToggleEnabled(featuremgmt.FlagDatabaseMetrics) {
					logParams = append(logParams, "db_call_count", log.TotalDBCallCount(ctx.Req.Context()))
				}

				if handler, exist := routeOperationName(ctx.Req); exist {
					logParams = append(logParams, "handler", handler)
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
		})
	}
}

var sensitiveQueryStrings = [...]string{
	"auth_token",
}

func SanitizeURL(ctx *models.ReqContext, s string) string {
	if s == "" {
		return s
	}

	u, err := url.ParseRequestURI(s)
	if err != nil {
		ctx.Logger.Warn("Received invalid referer in request headers, removed for log forgery prevention")
		return ""
	}

	// strip out sensitive query strings
	values := u.Query()
	for _, query := range sensitiveQueryStrings {
		values.Del(query)
	}
	u.RawQuery = values.Encode()

	return u.String()
}
