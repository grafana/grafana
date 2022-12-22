// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestAutoTransaction(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type TestTx struct {
		Id      int64     `xorm:"autoincr pk"`
		Msg     string    `xorm:"varchar(255)"`
		Created time.Time `xorm:"created"`
	}

	assert.NoError(t, testEngine.Sync2(new(TestTx)))

	engine := testEngine.(*Engine)

	// will success
	engine.Transaction(func(session *Session) (interface{}, error) {
		_, err := session.Insert(TestTx{Msg: "hi"})
		assert.NoError(t, err)

		return nil, nil
	})

	has, err := engine.Exist(&TestTx{Msg: "hi"})
	assert.NoError(t, err)
	assert.EqualValues(t, true, has)

	// will rollback
	_, err = engine.Transaction(func(session *Session) (interface{}, error) {
		_, err := session.Insert(TestTx{Msg: "hello"})
		assert.NoError(t, err)

		return nil, fmt.Errorf("rollback")
	})
	assert.Error(t, err)

	has, err = engine.Exist(&TestTx{Msg: "hello"})
	assert.NoError(t, err)
	assert.EqualValues(t, false, has)
}
