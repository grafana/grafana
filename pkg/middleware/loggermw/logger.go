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
	"fmt"
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

			if ctx != nil {
				logParams, logger := l.prepareLogParams(ctx, duration)
				logger.LogFunc(ctx.Logger)("Request Completed", logParams...)
			}
		})
	}
}

func (l *loggerImpl) prepareLogParams(c *contextmodel.ReqContext, duration time.Duration) ([]any, errutil.LogLevel) {
	rw := c.Resp
	r := c.Req

	status := rw.Status()
	lvl := errutil.LevelInfo

	switch {
	case status == http.StatusOK, status == http.StatusNotModified:
		if !l.cfg.RouterLogging {
			lvl = errutil.LevelNever
		}
	case status >= http.StatusInternalServerError:
		lvl = errutil.LevelError
	}

	logParams := []any{
		"method", r.Method,
		"path", r.URL.Path,
		"status", status,
		"remote_addr", c.RemoteAddr(),
		"time_ms", int64(duration / time.Millisecond),
		"duration", duration.String(),
		"size", rw.Size(),
	}

	referer, err := SanitizeURL(r.Referer())
	// We add an empty referer when there's a parsing error, hence this is before the err check.
	logParams = append(logParams, "referer", referer)
	if err != nil {
		logParams = append(logParams, "refererParsingErr", fmt.Errorf("received invalid referer in request headers, removed for log forgery prevention: %w", err))
		lvl = lvl.HighestOf(errutil.LevelWarn)
	}

	if l.cfg.DatabaseInstrumentQueries {
		logParams = append(logParams, "db_call_count", log.TotalDBCallCount(c.Req.Context()))
	}

	if handler, exist := middleware.RouteOperationName(c.Req); exist {
		logParams = append(logParams, "handler", handler)
	}

	logParams = append(logParams, errorLogParams(c.Error)...)

	return logParams, lvl
}

func errorLogParams(err error) []any {
	if err == nil {
		return nil
	}

	var gfErr errutil.Error
	if !errors.As(err, &gfErr) {
		return []any{"error", err.Error()}
	}

	return []any{
		"errorReason", gfErr.Reason,
		"errorMessageID", gfErr.MessageID,
		"error", gfErr.LogMessage,
	}
}

var sensitiveQueryStrings = [...]string{
	"auth_token",
}

func SanitizeURL(s string) (string, error) {
	if s == "" {
		return s, nil
	}

	u, err := url.ParseRequestURI(s)
	if err != nil {
		return "", fmt.Errorf("failed to sanitize URL")
	}

	// strip out sensitive query strings
	values := u.Query()
	for _, query := range sensitiveQueryStrings {
		values.Del(query)
	}
	u.RawQuery = values.Encode()

	return u.String(), nil
}
