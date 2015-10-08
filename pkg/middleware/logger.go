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
	"time"

	"github.com/Unknwon/macaron"
	"github.com/grafana/grafana/pkg/log"
)

func Logger() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		start := time.Now()

		rw := res.(macaron.ResponseWriter)
		c.Next()

		content := fmt.Sprintf("Completed %s %v %s in %v", req.URL.Path, rw.Status(), http.StatusText(rw.Status()), time.Since(start))

		switch rw.Status() {
		case 200, 304:
			content = fmt.Sprintf("%s", content)
			return
		case 404:
			content = fmt.Sprintf("%s", content)
		case 500:
			content = fmt.Sprintf("%s", content)
		}

		log.Info(content)
	}
}
