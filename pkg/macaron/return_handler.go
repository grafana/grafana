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

package macaron

import (
	"net/http"
	"reflect"

	"github.com/go-macaron/inject"
)

// ReturnHandler is a service that Martini provides that is called
// when a route handler returns something. The ReturnHandler is
// responsible for writing to the ResponseWriter based on the values
// that are passed into this function.
type ReturnHandler func(*Context, []reflect.Value)

func canDeref(val reflect.Value) bool {
	return val.Kind() == reflect.Interface || val.Kind() == reflect.Ptr
}

func isError(val reflect.Value) bool {
	_, ok := val.Interface().(error)
	return ok
}

func isByteSlice(val reflect.Value) bool {
	return val.Kind() == reflect.Slice && val.Type().Elem().Kind() == reflect.Uint8
}

func defaultReturnHandler() ReturnHandler {
	return func(ctx *Context, vals []reflect.Value) {
		rv := ctx.GetVal(inject.InterfaceOf((*http.ResponseWriter)(nil)))
		resp := rv.Interface().(http.ResponseWriter)
		var respVal reflect.Value
		if len(vals) > 1 && vals[0].Kind() == reflect.Int {
			resp.WriteHeader(int(vals[0].Int()))
			respVal = vals[1]
		} else if len(vals) > 0 {
			respVal = vals[0]

			if isError(respVal) {
				err := respVal.Interface().(error)
				if err != nil {
					ctx.internalServerError(ctx, err)
				}
				return
			} else if canDeref(respVal) {
				if respVal.IsNil() {
					return // Ignore nil error
				}
			}
		}
		if canDeref(respVal) {
			respVal = respVal.Elem()
		}
		if isByteSlice(respVal) {
			_, _ = resp.Write(respVal.Bytes())
		} else {
			_, _ = resp.Write([]byte(respVal.String()))
		}
	}
}
