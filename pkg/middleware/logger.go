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
	"github.com/Cepave/grafana/pkg/log"
<<<<<<< a84f1f0a3df6380f5a6561dd65aca819f7df5e8a
	"github.com/Cepave/grafana/pkg/setting"
=======
>>>>>>> Replace the import path with github.com/Cepave/grafana.
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
<<<<<<< 5aed00979aa8f2b04b309ef13d8eb287478cd207
			if !setting.RouterLogging {
				return
			}
=======
			return
>>>>>>> fixed gofmt issue
		case 404:
			content = fmt.Sprintf("%s", content)
		case 500:
			content = fmt.Sprintf("%s", content)
		}

		log.Info(content)
	}
}
