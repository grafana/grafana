// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCacheTag(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type CacheDomain struct {
		Id   int64 `xorm:"pk cache"`
		Name string
	}

	assert.NoError(t, testEngine.CreateTables(&CacheDomain{}))
	assert.True(t, testEngine.GetCacher(testEngine.TableName(&CacheDomain{})) != nil)
}

func TestNoCacheTag(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type NoCacheDomain struct {
		Id   int64 `xorm:"pk nocache"`
		Name string
	}

	assert.NoError(t, testEngine.CreateTables(&NoCacheDomain{}))
	assert.True(t, testEngine.GetCacher(testEngine.TableName(&NoCacheDomain{})) == nil)
}
