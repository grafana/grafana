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

package macaron

import (
	"net/http"
	"net/url"
	"reflect"
	"strconv"
	"strings"
)

// Request represents an HTTP request received by a server or to be sent by a client.
type Request struct {
	*http.Request
}

// ContextInvoker is an inject.FastInvoker wrapper of func(ctx *Context).
type ContextInvoker func(ctx *Context)

// Invoke implements inject.FastInvoker which simplifies calls of `func(ctx *Context)` function.
func (invoke ContextInvoker) Invoke(params []interface{}) ([]reflect.Value, error) {
	invoke(params[0].(*Context))
	return nil, nil
}

// Context represents the runtime context of current request of Macaron instance.
// It is the integration of most frequently used middlewares and helper methods.
type Context struct {
	Injector
	handlers []Handler
	index    int

	*Router
	Req    Request
	Resp   ResponseWriter
	params Params
	Render
	Data map[string]interface{}
}

func (ctx *Context) handler() Handler {
	if ctx.index < len(ctx.handlers) {
		return ctx.handlers[ctx.index]
	}
	if ctx.index == len(ctx.handlers) {
		return func() {}
	}
	panic("invalid index for context handler")
}

// Next runs the next handler in the context chain
func (ctx *Context) Next() {
	ctx.index++
	ctx.run()
}

// Written returns whether the context response has been written to
func (ctx *Context) Written() bool {
	return ctx.Resp.Written()
}

func (ctx *Context) run() {
	for ctx.index <= len(ctx.handlers) {
		vals, err := ctx.Invoke(ctx.handler())
		if err != nil {
			panic(err)
		}
		ctx.index++

		// if the handler returned something, write it to the http response
		if len(vals) > 0 {
			ev := ctx.GetVal(reflect.TypeOf(ReturnHandler(nil)))
			handleReturn := ev.Interface().(ReturnHandler)
			handleReturn(ctx, vals)
		}

		if ctx.Written() {
			return
		}
	}
}

// RemoteAddr returns more real IP address.
func (ctx *Context) RemoteAddr() string {
	addr := ctx.Req.Header.Get("X-Real-IP")
	if len(addr) == 0 {
		addr = ctx.Req.Header.Get("X-Forwarded-For")
		if addr == "" {
			addr = ctx.Req.RemoteAddr
			if i := strings.LastIndex(addr, ":"); i > -1 {
				addr = addr[:i]
			}
		}
	}
	return addr
}

func (ctx *Context) renderHTML(status int, setName, tplName string, data ...interface{}) {
	if len(data) <= 0 {
		ctx.Render.HTMLSet(status, setName, tplName, ctx.Data)
	} else if len(data) == 1 {
		ctx.Render.HTMLSet(status, setName, tplName, data[0])
	} else {
		ctx.Render.HTMLSet(status, setName, tplName, data[0], data[1].(HTMLOptions))
	}
}

// HTML renders the HTML with default template set.
func (ctx *Context) HTML(status int, name string, data ...interface{}) {
	ctx.renderHTML(status, DEFAULT_TPL_SET_NAME, name, data...)
}

// Redirect sends a redirect response
func (ctx *Context) Redirect(location string, status ...int) {
	code := http.StatusFound
	if len(status) == 1 {
		code = status[0]
	}

	http.Redirect(ctx.Resp, ctx.Req.Request, location, code)
}

// MaxMemory is the maximum amount of memory to use when parsing a multipart form.
// Set this to whatever value you prefer; default is 10 MB.
var MaxMemory = int64(1024 * 1024 * 10)

func (ctx *Context) parseForm() {
	if ctx.Req.Form != nil {
		return
	}

	contentType := ctx.Req.Header.Get(_CONTENT_TYPE)
	if (ctx.Req.Method == "POST" || ctx.Req.Method == "PUT") &&
		len(contentType) > 0 && strings.Contains(contentType, "multipart/form-data") {
		_ = ctx.Req.ParseMultipartForm(MaxMemory)
	} else {
		_ = ctx.Req.ParseForm()
	}
}

// Query querys form parameter.
func (ctx *Context) Query(name string) string {
	ctx.parseForm()
	return ctx.Req.Form.Get(name)
}

// QueryStrings returns a list of results by given query name.
func (ctx *Context) QueryStrings(name string) []string {
	ctx.parseForm()

	vals, ok := ctx.Req.Form[name]
	if !ok {
		return []string{}
	}
	return vals
}

// QueryBool returns query result in bool type.
func (ctx *Context) QueryBool(name string) bool {
	v, _ := strconv.ParseBool(ctx.Query(name))
	return v
}

// QueryInt returns query result in int type.
func (ctx *Context) QueryInt(name string) int {
	n, _ := strconv.Atoi(ctx.Query(name))
	return n
}

// QueryInt64 returns query result in int64 type.
func (ctx *Context) QueryInt64(name string) int64 {
	n, _ := strconv.ParseInt(ctx.Query(name), 10, 64)
	return n
}

// Params returns value of given param name.
// e.g. ctx.Params(":uid") or ctx.Params("uid")
func (ctx *Context) Params(name string) string {
	if len(name) == 0 {
		return ""
	}
	if len(name) > 1 && name[0] != ':' {
		name = ":" + name
	}
	return ctx.params[name]
}

// AllParams returns all params.
func (ctx *Context) AllParams() Params {
	return ctx.params
}

// ReplaceAllParams replace all current params with given params
func (ctx *Context) ReplaceAllParams(params Params) {
	ctx.params = params
}

// ParamsInt64 returns params result in int64 type.
// e.g. ctx.ParamsInt64(":uid")
func (ctx *Context) ParamsInt64(name string) int64 {
	n, _ := strconv.ParseInt(ctx.Params(name), 10, 64)
	return n
}

// GetCookie returns given cookie value from request header.
func (ctx *Context) GetCookie(name string) string {
	cookie, err := ctx.Req.Cookie(name)
	if err != nil {
		return ""
	}
	val, _ := url.QueryUnescape(cookie.Value)
	return val
}
