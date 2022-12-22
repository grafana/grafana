// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestQueryContext(t *testing.T) {
	type ContextQueryStruct struct {
		Id   int64
		Name string
	}

	assert.NoError(t, prepareEngine())
	assertSync(t, new(ContextQueryStruct))

	_, err := testEngine.Insert(&ContextQueryStruct{Name: "1"})
	assert.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), time.Nanosecond)
	defer cancel()

	time.Sleep(time.Nanosecond)

	has, err := testEngine.Context(ctx).Exist(&ContextQueryStruct{Name: "1"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "context deadline exceeded")
	assert.False(t, has)
}
