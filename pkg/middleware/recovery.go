// Copyright 2013 Martini Authors
// Copyright 2014 The Macaron Authors
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
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/stacktrace"
	"github.com/grafana/grafana/pkg/web"
)

// Recovery returns a middleware that recovers from any panics and writes a 500 if there was one.
// While Martini is in development mode, Recovery will also output the panic as HTML.
func Recovery(cfg *setting.Cfg) web.Handler {
	return func(c *web.Context) {
		defer func() {
			if r := recover(); r != nil {
				panicLogger := log.Root
				// try to get request logger
				ctx := contexthandler.FromContext(c.Req.Context())
				if ctx != nil {
					panicLogger = ctx.Logger
				}

				if err, ok := r.(error); ok {
					// http.ErrAbortHandler is suppressed by default in the http package
					// and used as a signal for aborting requests. Suppresses stacktrace
					// since it doesn't add any important information.
					if errors.Is(err, http.ErrAbortHandler) {
						panicLogger.Error("Request error", "error", err)
						return
					}
				}

				stack := stacktrace.Stack(3)
				panicLogger.Error("Request error", "error", r, "stack", string(stack))

				// if response has already been written, skip.
				if c.Resp.Written() {
					return
				}

				data := struct {
					Title     string
					AppTitle  string
					AppSubUrl string
					Theme     string
					ErrorMsg  string
				}{"Server Error", "Grafana", cfg.AppSubURL, cfg.DefaultTheme, ""}

				if setting.Env == setting.Dev {
					if err, ok := r.(error); ok {
						data.Title = err.Error()
					}

					data.ErrorMsg = string(stack)
				}

				if ctx != nil && ctx.IsApiRequest() {
					resp := make(map[string]interface{})
					resp["message"] = "Internal Server Error - Check the Grafana server logs for the detailed error message."

					if data.ErrorMsg != "" {
						resp["error"] = fmt.Sprintf("%v - %v", data.Title, data.ErrorMsg)
					} else {
						resp["error"] = data.Title
					}

					c.JSON(500, resp)
				} else {
					c.HTML(500, cfg.ErrTemplateName, data)
				}
			}
		}()

		c.Next()
	}
}
