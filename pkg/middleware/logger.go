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
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	opentracing "github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/uber/jaeger-client-go"
	"gopkg.in/macaron.v1"
)

func Logger() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		start := time.Now()
		c.Data["perfmon.start"] = start

		rw := res.(macaron.ResponseWriter)
		c.Next()

		timeTaken := time.Since(start) / time.Millisecond

		if timer, ok := c.Data["perfmon.timer"]; ok {
			timerTyped := timer.(prometheus.Summary)
			timerTyped.Observe(float64(timeTaken))
		}

		status := rw.Status()
		if status == 200 || status == 304 {
			if !setting.RouterLogging {
				return
			}
		}

		if ctx, ok := c.Data["ctx"]; ok {
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

			traceID, exist := extractTraceID(ctxTyped.Req.Request.Context())
			if exist {
				logParams = append(logParams, "traceID", traceID)
			}

			if status >= 500 {
				ctxTyped.Logger.Error("Request Completed", logParams...)
			} else {
				ctxTyped.Logger.Info("Request Completed", logParams...)
			}
		}
	}
}

func extractTraceID(ctx context.Context) (string, bool) {
	sp := opentracing.SpanFromContext(ctx)
	if sp == nil {
		return "", false
	}
	sctx, ok := sp.Context().(jaeger.SpanContext)
	if !ok {
		return "", false
	}

	return sctx.TraceID().String(), true
}
