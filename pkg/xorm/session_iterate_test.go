// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIterate(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type UserIterate struct {
		Id    int64
		IsMan bool
	}

	assert.NoError(t, testEngine.Sync2(new(UserIterate)))

	cnt, err := testEngine.Insert(&UserIterate{
		IsMan: true,
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	cnt = 0
	err = testEngine.Iterate(new(UserIterate), func(i int, bean interface{}) error {
		user := bean.(*UserIterate)
		assert.EqualValues(t, 1, user.Id)
		assert.EqualValues(t, true, user.IsMan)
		cnt++
		return nil
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
}

func TestBufferIterate(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type UserBufferIterate struct {
		Id    int64
		IsMan bool
	}

	assert.NoError(t, testEngine.Sync2(new(UserBufferIterate)))

	var size = 20
	for i := 0; i < size; i++ {
		cnt, err := testEngine.Insert(&UserBufferIterate{
			IsMan: true,
		})
		assert.NoError(t, err)
		assert.EqualValues(t, 1, cnt)
	}

	var cnt = 0
	err := testEngine.BufferSize(9).Iterate(new(UserBufferIterate), func(i int, bean interface{}) error {
		user := bean.(*UserBufferIterate)
		assert.EqualValues(t, cnt+1, user.Id)
		assert.EqualValues(t, true, user.IsMan)
		cnt++
		return nil
	})
	assert.NoError(t, err)
	assert.EqualValues(t, size, cnt)

	cnt = 0
	err = testEngine.Limit(20).BufferSize(9).Iterate(new(UserBufferIterate), func(i int, bean interface{}) error {
		user := bean.(*UserBufferIterate)
		assert.EqualValues(t, cnt+1, user.Id)
		assert.EqualValues(t, true, user.IsMan)
		cnt++
		return nil
	})
	assert.NoError(t, err)
	assert.EqualValues(t, size, cnt)

	cnt = 0
	err = testEngine.Limit(7).BufferSize(9).Iterate(new(UserBufferIterate), func(i int, bean interface{}) error {
		user := bean.(*UserBufferIterate)
		assert.EqualValues(t, cnt+1, user.Id)
		assert.EqualValues(t, true, user.IsMan)
		cnt++
		return nil
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 7, cnt)

	cnt = 0
	err = testEngine.Where("id <= 10").BufferSize(2).Iterate(new(UserBufferIterate), func(i int, bean interface{}) error {
		user := bean.(*UserBufferIterate)
		assert.EqualValues(t, cnt+1, user.Id)
		assert.EqualValues(t, true, user.IsMan)
		cnt++
		return nil
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 10, cnt)
}
