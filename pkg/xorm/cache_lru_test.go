// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"xorm.io/core"
)

func TestLRUCache(t *testing.T) {
	type CacheObject1 struct {
		Id int64
	}

	store := NewMemoryStore()
	cacher := NewLRUCacher(store, 10000)

	tableName := "cache_object1"
	pks := []core.PK{
		{1},
		{2},
	}

	for _, pk := range pks {
		sid, err := pk.ToString()
		assert.NoError(t, err)

		cacher.PutIds(tableName, "select * from cache_object1", sid)
		ids := cacher.GetIds(tableName, "select * from cache_object1")
		assert.EqualValues(t, sid, ids)

		cacher.ClearIds(tableName)
		ids2 := cacher.GetIds(tableName, "select * from cache_object1")
		assert.Nil(t, ids2)

		obj2 := cacher.GetBean(tableName, sid)
		assert.Nil(t, obj2)

		var obj = new(CacheObject1)
		cacher.PutBean(tableName, sid, obj)
		obj3 := cacher.GetBean(tableName, sid)
		assert.EqualValues(t, obj, obj3)

		cacher.DelBean(tableName, sid)
		obj4 := cacher.GetBean(tableName, sid)
		assert.Nil(t, obj4)
	}
}
