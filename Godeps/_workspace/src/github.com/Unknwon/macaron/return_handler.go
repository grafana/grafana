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
	"net/http"
	"reflect"

	"github.com/Unknwon/macaron/inject"
)

// ReturnHandler is a service that Martini provides that is called
// when a route handler returns something. The ReturnHandler is
// responsible for writing to the ResponseWriter based on the values
// that are passed into this function.
type ReturnHandler func(*Context, []reflect.Value)

func canDeref(val reflect.Value) bool {
	return val.Kind() == reflect.Interface || val.Kind() == reflect.Ptr
}

func isByteSlice(val reflect.Value) bool {
	return val.Kind() == reflect.Slice && val.Type().Elem().Kind() == reflect.Uint8
}

func defaultReturnHandler() ReturnHandler {
	return func(ctx *Context, vals []reflect.Value) {
		rv := ctx.GetVal(inject.InterfaceOf((*http.ResponseWriter)(nil)))
		res := rv.Interface().(http.ResponseWriter)
		var respVal reflect.Value
		if len(vals) > 1 && vals[0].Kind() == reflect.Int {
			res.WriteHeader(int(vals[0].Int()))
			respVal = vals[1]
		} else if len(vals) > 0 {
			respVal = vals[0]
		}
		if canDeref(respVal) {
			respVal = respVal.Elem()
		}
		if isByteSlice(respVal) {
			res.Write(respVal.Bytes())
		} else {
			res.Write([]byte(respVal.String()))
		}
	}
}
