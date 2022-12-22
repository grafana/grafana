// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build go1.8

package xorm

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestPingContext(t *testing.T) {
	assert.NoError(t, prepareEngine())

	ctx, canceled := context.WithTimeout(context.Background(), time.Nanosecond)
	defer canceled()

	time.Sleep(time.Nanosecond)

	err := testEngine.(*Engine).PingContext(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "context deadline exceeded")
}
