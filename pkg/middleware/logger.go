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
	"fmt"
	"net/http"
	"runtime"
	"time"

	"github.com/Unknwon/macaron"
	"github.com/Cepave/grafana/pkg/log"
)

var isWindows bool

func init() {
	isWindows = runtime.GOOS == "windows"
}

// Logger returns a middleware handler that logs the request as it goes in and the response as it goes out.
func Logger() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		start := time.Now()

		rw := res.(macaron.ResponseWriter)
		c.Next()

		content := fmt.Sprintf("Completed %s %v %s in %v", req.URL.Path, rw.Status(), http.StatusText(rw.Status()), time.Since(start))
		if !isWindows {
			switch rw.Status() {
			case 200:
				content = fmt.Sprintf("\033[1;32m%s\033[0m", content)
				return
			case 304:
				//content = fmt.Sprintf("\033[1;33m%s\033[0m", content)
				return
			case 404:
				content = fmt.Sprintf("\033[1;31m%s\033[0m", content)
			case 500:
				content = fmt.Sprintf("\033[1;36m%s\033[0m", content)
			}
		}
		log.Info(content)
	}
}
