// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import "encoding/json"

// JSONInterface represents an interface to handle json data
type JSONInterface interface {
	Marshal(v interface{}) ([]byte, error)
	Unmarshal(data []byte, v interface{}) error
}

var (
	// DefaultJSONHandler default json handler
	DefaultJSONHandler JSONInterface = StdJSON{}
)

// StdJSON implements JSONInterface via encoding/json
type StdJSON struct{}

// Marshal implements JSONInterface
func (StdJSON) Marshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

// Unmarshal implements JSONInterface
func (StdJSON) Unmarshal(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}
