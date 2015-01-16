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

package macaron

import (
	"bufio"
	"compress/gzip"
	"fmt"
	"net"
	"net/http"
	"strings"
)

const (
	HeaderAcceptEncoding  = "Accept-Encoding"
	HeaderContentEncoding = "Content-Encoding"
	HeaderContentLength   = "Content-Length"
	HeaderContentType     = "Content-Type"
	HeaderVary            = "Vary"
)

// Gziper returns a Handler that adds gzip compression to all requests.
// Make sure to include the Gzip middleware above other middleware
// that alter the response body (like the render middleware).
func Gziper() Handler {
	return func(ctx *Context) {
		if !strings.Contains(ctx.Req.Header.Get(HeaderAcceptEncoding), "gzip") {
			return
		}

		headers := ctx.Resp.Header()
		headers.Set(HeaderContentEncoding, "gzip")
		headers.Set(HeaderVary, HeaderAcceptEncoding)

		gz := gzip.NewWriter(ctx.Resp)
		defer gz.Close()

		gzw := gzipResponseWriter{gz, ctx.Resp}
		ctx.Resp = gzw
		ctx.MapTo(gzw, (*http.ResponseWriter)(nil))

		ctx.Next()

		// delete content length after we know we have been written to
		gzw.Header().Del("Content-Length")
	}
}

type gzipResponseWriter struct {
	w *gzip.Writer
	ResponseWriter
}

func (grw gzipResponseWriter) Write(p []byte) (int, error) {
	if len(grw.Header().Get(HeaderContentType)) == 0 {
		grw.Header().Set(HeaderContentType, http.DetectContentType(p))
	}

	return grw.w.Write(p)
}

func (grw gzipResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := grw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("the ResponseWriter doesn't support the Hijacker interface")
	}
	return hijacker.Hijack()
}
