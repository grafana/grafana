// Copyright 2013 Martini Authors
// Copyright 2015 The Macaron Authors
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

package gzip

import (
	"bufio"
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/klauspost/compress/gzip"
	"gopkg.in/macaron.v1"
)

const (
	_HEADER_ACCEPT_ENCODING  = "Accept-Encoding"
	_HEADER_CONTENT_ENCODING = "Content-Encoding"
	_HEADER_CONTENT_LENGTH   = "Content-Length"
	_HEADER_CONTENT_TYPE     = "Content-Type"
	_HEADER_VARY             = "Vary"
)

// Options represents a struct for specifying configuration options for the GZip middleware.
type Options struct {
	// Compression level. Can be DefaultCompression(-1), ConstantCompression(-2)
	// or any integer value between BestSpeed(1) and BestCompression(9) inclusive.
	CompressionLevel int
}

func isCompressionLevelValid(level int) bool {
	return level == gzip.DefaultCompression ||
		level == gzip.ConstantCompression ||
		(level >= gzip.BestSpeed && level <= gzip.BestCompression)
}

func prepareOptions(options []Options) Options {
	var opt Options
	if len(options) > 0 {
		opt = options[0]
	}

	if !isCompressionLevelValid(opt.CompressionLevel) {
		// For web content, level 4 seems to be a sweet spot.
		opt.CompressionLevel = 4
	}
	return opt
}

// Gziper returns a Handler that adds gzip compression to all requests.
// Make sure to include the Gzip middleware above other middleware
// that alter the response body (like the render middleware).
func Gziper(options ...Options) macaron.Handler {
	opt := prepareOptions(options)

	return func(ctx *macaron.Context) {
		if !strings.Contains(ctx.Req.Header.Get(_HEADER_ACCEPT_ENCODING), "gzip") {
			return
		}

		headers := ctx.Resp.Header()
		headers.Set(_HEADER_CONTENT_ENCODING, "gzip")
		headers.Set(_HEADER_VARY, _HEADER_ACCEPT_ENCODING)

		// We've made sure compression level is valid in prepareGzipOptions,
		// no need to check same error again.
		gz, err := gzip.NewWriterLevel(ctx.Resp, opt.CompressionLevel)
		if err != nil {
			panic(err.Error())
		}
		defer gz.Close()

		gzw := gzipResponseWriter{gz, ctx.Resp}
		ctx.Resp = gzw
		ctx.MapTo(gzw, (*http.ResponseWriter)(nil))
		if ctx.Render != nil {
			ctx.Render.SetResponseWriter(gzw)
		}

		ctx.Next()

		// delete content length after we know we have been written to
		gzw.Header().Del("Content-Length")
	}
}

type gzipResponseWriter struct {
	w *gzip.Writer
	macaron.ResponseWriter
}

func (grw gzipResponseWriter) Write(p []byte) (int, error) {
	if len(grw.Header().Get(_HEADER_CONTENT_TYPE)) == 0 {
		grw.Header().Set(_HEADER_CONTENT_TYPE, http.DetectContentType(p))
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
