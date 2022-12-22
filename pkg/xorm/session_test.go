// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestClose(t *testing.T) {
	assert.NoError(t, prepareEngine())

	sess1 := testEngine.NewSession()
	sess1.Close()
	assert.True(t, sess1.IsClosed())

	sess2 := testEngine.Where("a = ?", 1)
	sess2.Close()
	assert.True(t, sess2.IsClosed())
}

func TestNullFloatStruct(t *testing.T) {
	type MyNullFloat64 sql.NullFloat64

	type MyNullFloatStruct struct {
		Uuid   string
		Amount MyNullFloat64
	}

	assert.NoError(t, prepareEngine())
	assert.NoError(t, testEngine.Sync2(new(MyNullFloatStruct)))

	_, err := testEngine.Insert(&MyNullFloatStruct{
		Uuid: "111111",
		Amount: MyNullFloat64(sql.NullFloat64{
			Float64: 0.1111,
			Valid:   true,
		}),
	})
	assert.NoError(t, err)
}
