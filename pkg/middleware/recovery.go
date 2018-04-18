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
	"bytes"
	"fmt"
	"io/ioutil"
	"runtime"

	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	dunno     = []byte("???")
	centerDot = []byte("·")
	dot       = []byte(".")
	slash     = []byte("/")
)

// stack returns a nicely formatted stack frame, skipping skip frames
func stack(skip int) []byte {
	buf := new(bytes.Buffer) // the returned data
	// As we loop, we open files and read them. These variables record the currently
	// loaded file.
	var lines [][]byte
	var lastFile string
	for i := skip; ; i++ { // Skip the expected number of frames
		pc, file, line, ok := runtime.Caller(i)
		if !ok {
			break
		}
		// Print this much at least.  If we can't find the source, it won't show.
		fmt.Fprintf(buf, "%s:%d (0x%x)\n", file, line, pc)
		if file != lastFile {
			data, err := ioutil.ReadFile(file)
			if err != nil {
				continue
			}
			lines = bytes.Split(data, []byte{'\n'})
			lastFile = file
		}
		fmt.Fprintf(buf, "\t%s: %s\n", function(pc), source(lines, line))
	}
	return buf.Bytes()
}

// source returns a space-trimmed slice of the n'th line.
func source(lines [][]byte, n int) []byte {
	n-- // in stack trace, lines are 1-indexed but our array is 0-indexed
	if n < 0 || n >= len(lines) {
		return dunno
	}
	return bytes.TrimSpace(lines[n])
}

// function returns, if possible, the name of the function containing the PC.
func function(pc uintptr) []byte {
	fn := runtime.FuncForPC(pc)
	if fn == nil {
		return dunno
	}
	name := []byte(fn.Name())
	// The name includes the path name to the package, which is unnecessary
	// since the file name is already included.  Plus, it has center dots.
	// That is, we see
	//	runtime/debug.*T·ptrmethod
	// and want
	//	*T.ptrmethod
	// Also the package path might contains dot (e.g. code.google.com/...),
	// so first eliminate the path prefix
	if lastslash := bytes.LastIndex(name, slash); lastslash >= 0 {
		name = name[lastslash+1:]
	}
	if period := bytes.Index(name, dot); period >= 0 {
		name = name[period+1:]
	}
	name = bytes.Replace(name, centerDot, dot, -1)
	return name
}

// Recovery returns a middleware that recovers from any panics and writes a 500 if there was one.
// While Martini is in development mode, Recovery will also output the panic as HTML.
func Recovery() macaron.Handler {
	return func(c *macaron.Context) {
		defer func() {
			if err := recover(); err != nil {
				stack := stack(3)

				panicLogger := log.Root
				// try to get request logger
				if ctx, ok := c.Data["ctx"]; ok {
					ctxTyped := ctx.(*m.ReqContext)
					panicLogger = ctxTyped.Logger
				}

				panicLogger.Error("Request error", "error", err, "stack", string(stack))

				c.Data["Title"] = "Server Error"
				c.Data["AppSubUrl"] = setting.AppSubUrl

				if setting.Env == setting.DEV {
					if theErr, ok := err.(error); ok {
						c.Data["Title"] = theErr.Error()
					}

					c.Data["ErrorMsg"] = string(stack)
				}

				ctx, ok := c.Data["ctx"].(*m.ReqContext)

				if ok && ctx.IsApiRequest() {
					resp := make(map[string]interface{})
					resp["message"] = "Internal Server Error - Check the Grafana server logs for the detailed error message."

					if c.Data["ErrorMsg"] != nil {
						resp["error"] = fmt.Sprintf("%v - %v", c.Data["Title"], c.Data["ErrorMsg"])
					} else {
						resp["error"] = c.Data["Title"]
					}

					c.JSON(500, resp)
				} else {
					c.HTML(500, "error")
				}
			}
		}()

		c.Next()
	}
}
