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

package loggermw

import (
	"errors"
	"net/http"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/middleware"

	"github.com/grafana/grafana/pkg/util/errutil"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type Logger interface {
	Middleware() web.Middleware
}

type loggerImpl struct {
	cfg   *setting.Cfg
	flags featuremgmt.FeatureToggles
}

func Provide(
	cfg *setting.Cfg,
	flags featuremgmt.FeatureToggles,
) Logger {
	return &loggerImpl{
		cfg:   cfg,
		flags: flags,
	}
}

func (l *loggerImpl) Middleware() web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// we have to init the context with the counter here to update the request
			r = r.WithContext(log.InitCounter(r.Context()))
			// put the start time on context so we can measure it later.
			r = r.WithContext(log.InitstartTime(r.Context(), time.Now()))

			if l.flags.IsEnabled(featuremgmt.FlagUnifiedRequestLog) {
				r = r.WithContext(errutil.SetUnifiedLogging(r.Context()))
			}

			rw := web.Rw(w, r)
			next.ServeHTTP(rw, r)

			duration := time.Since(start)
			timeTaken := duration / time.Millisecond
			ctx := contexthandler.FromContext(r.Context())
			if ctx != nil && ctx.PerfmonTimer != nil {
				ctx.PerfmonTimer.Observe(float64(timeTaken))
			}

			status := rw.Status()
			if status == 200 || status == 304 {
				if !l.cfg.RouterLogging {
					return
				}
			}

			if ctx != nil {
				logParams := l.prepareLogParams(ctx, r, rw, duration)

				if status >= 500 {
					ctx.Logger.Error("Request Completed", logParams...)
				} else {
					ctx.Logger.Info("Request Completed", logParams...)
				}
			}
		})
	}
}

func (l *loggerImpl) prepareLogParams(c *contextmodel.ReqContext, r *http.Request, rw web.ResponseWriter, duration time.Duration) []any {
	logParams := []interface{}{
		"method", r.Method,
		"path", r.URL.Path,
		"status", rw.Status(),
		"remote_addr", c.RemoteAddr(),
		"time_ms", int64(duration / time.Millisecond),
		"duration", duration.String(),
		"size", rw.Size(),
		"referer", SanitizeURL(c, r.Referer()),
	}

	if l.flags.IsEnabled(featuremgmt.FlagDatabaseMetrics) {
		logParams = append(logParams, "db_call_count", log.TotalDBCallCount(c.Req.Context()))
	}

	if handler, exist := middleware.RouteOperationName(c.Req); exist {
		logParams = append(logParams, "handler", handler)
	}

	logParams = append(logParams, errorLogParams(c.Error)...)

	return logParams
}

func errorLogParams(err error) []any {
	if err == nil {
		return nil
	}

	var gfErr errutil.Error
	if !errors.As(err, &gfErr) {
		return []any{"err", err.Error()}
	}

	return []any{
		"errReason", gfErr.Reason,
		"errMessageID", gfErr.MessageID,
		"err", gfErr.LogMessage,
	}
}

var sensitiveQueryStrings = [...]string{
	"auth_token",
}

func SanitizeURL(ctx *contextmodel.ReqContext, s string) string {
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
