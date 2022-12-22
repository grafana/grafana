// Copyright 2018 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

type MCC struct {
	ID          int64  `xorm:"pk 'id'"`
	Code        string `xorm:"'code'"`
	Description string `xorm:"'description'"`
}

func (mcc *MCC) TableName() string {
	return "mcc"
}

func TestTableName1(t *testing.T) {
	assert.NoError(t, prepareEngine())

	assert.EqualValues(t, "mcc", testEngine.TableName(new(MCC)))
	assert.EqualValues(t, "mcc", testEngine.TableName("mcc"))
}
