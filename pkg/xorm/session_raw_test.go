// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExecAndQuery(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type UserinfoQuery struct {
		Uid  int
		Name string
	}

	assert.NoError(t, testEngine.Sync2(new(UserinfoQuery)))

	res, err := testEngine.Exec("INSERT INTO "+testEngine.TableName("`userinfo_query`", true)+" (uid, name) VALUES (?, ?)", 1, "user")
	assert.NoError(t, err)
	cnt, err := res.RowsAffected()
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	results, err := testEngine.Query("select * from " + testEngine.TableName("userinfo_query", true))
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(results))
	id, err := strconv.Atoi(string(results[0]["uid"]))
	assert.NoError(t, err)
	assert.EqualValues(t, 1, id)
	assert.Equal(t, "user", string(results[0]["name"]))
}
