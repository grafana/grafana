// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRows(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type UserRows struct {
		Id    int64
		IsMan bool
	}

	assert.NoError(t, testEngine.Sync2(new(UserRows)))

	cnt, err := testEngine.Insert(&UserRows{
		IsMan: true,
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	rows, err := testEngine.Rows(new(UserRows))
	assert.NoError(t, err)
	defer rows.Close()

	cnt = 0
	user := new(UserRows)
	for rows.Next() {
		err = rows.Scan(user)
		assert.NoError(t, err)
		cnt++
	}
	assert.EqualValues(t, 1, cnt)
	assert.False(t, rows.Next())
	assert.NoError(t, rows.Close())

	rows0, err := testEngine.Where("1>1").Rows(new(UserRows))
	assert.NoError(t, err)
	defer rows0.Close()

	cnt = 0
	user0 := new(UserRows)
	for rows0.Next() {
		err = rows0.Scan(user0)
		assert.NoError(t, err)
		cnt++
	}
	assert.EqualValues(t, 0, cnt)
	assert.NoError(t, rows0.Close())

	sess := testEngine.NewSession()
	defer sess.Close()

	rows1, err := sess.Prepare().Rows(new(UserRows))
	assert.NoError(t, err)
	defer rows1.Close()

	cnt = 0
	for rows1.Next() {
		err = rows1.Scan(user)
		assert.NoError(t, err)
		cnt++
	}
	assert.EqualValues(t, 1, cnt)

	var tbName = testEngine.Quote(testEngine.TableName(user, true))
	rows2, err := testEngine.SQL("SELECT * FROM " + tbName).Rows(new(UserRows))
	assert.NoError(t, err)
	defer rows2.Close()

	cnt = 0
	for rows2.Next() {
		err = rows2.Scan(user)
		assert.NoError(t, err)
		cnt++
	}
	assert.EqualValues(t, 1, cnt)
}

func TestRowsMyTableName(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type UserRowsMyTable struct {
		Id    int64
		IsMan bool
	}

	var tableName = "user_rows_my_table_name"

	assert.NoError(t, testEngine.Table(tableName).Sync2(new(UserRowsMyTable)))

	cnt, err := testEngine.Table(tableName).Insert(&UserRowsMyTable{
		IsMan: true,
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	rows, err := testEngine.Table(tableName).Rows(new(UserRowsMyTable))
	assert.NoError(t, err)
	defer rows.Close()

	cnt = 0
	user := new(UserRowsMyTable)
	for rows.Next() {
		err = rows.Scan(user)
		assert.NoError(t, err)
		cnt++
	}
	assert.EqualValues(t, 1, cnt)
}

type UserRowsSpecTable struct {
	Id    int64
	IsMan bool
}

func (UserRowsSpecTable) TableName() string {
	return "user_rows_my_table_name"
}

func TestRowsSpecTableName(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assert.NoError(t, testEngine.Sync2(new(UserRowsSpecTable)))

	cnt, err := testEngine.Insert(&UserRowsSpecTable{
		IsMan: true,
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	rows, err := testEngine.Rows(new(UserRowsSpecTable))
	assert.NoError(t, err)
	defer rows.Close()

	cnt = 0
	user := new(UserRowsSpecTable)
	for rows.Next() {
		err = rows.Scan(user)
		assert.NoError(t, err)
		cnt++
	}
	assert.EqualValues(t, 1, cnt)
}
