// Copyright 2013 Julien Schmidt. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be found
// in the LICENSE file.
package tree

import "context"

// Param is a single URL parameter, consisting of a key and a value.
type Param struct {
	Key   string
	Value string
}

// Params is a Param-slice, as returned by the router.
// The slice is ordered, the first URL parameter is also the first slice value.
// It is therefore safe to read values by the index.
type Params []Param

// Get returns the value of the first Param which key matches the given name.
// If no matching Param is found, an empty string is returned.
func (ps Params) Get(name string) (string, bool) {
	for _, p := range ps {
		if p.Key == name {
			return p.Value, true
		}
	}
	return "", false
}

type paramsKey struct{}

// ParamsKey is the request context key under which URL Params are stored.
var ParamsKey = paramsKey{}

// ParamsFromContext pulls the URL parameters from a request context,
// or returns nil if none are present.
func ParamsFromContext(ctx context.Context) Params {
	p, _ := ctx.Value(ParamsKey).(Params)
	return p
}
