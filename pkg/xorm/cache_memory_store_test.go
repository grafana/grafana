// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMemoryStore(t *testing.T) {
	store := NewMemoryStore()
	var kvs = map[string]interface{}{
		"a": "b",
	}
	for k, v := range kvs {
		assert.NoError(t, store.Put(k, v))
	}

	for k, v := range kvs {
		val, err := store.Get(k)
		assert.NoError(t, err)
		assert.EqualValues(t, v, val)
	}

	for k := range kvs {
		err := store.Del(k)
		assert.NoError(t, err)
	}

	for k := range kvs {
		_, err := store.Get(k)
		assert.EqualValues(t, ErrNotExist, err)
	}
}
