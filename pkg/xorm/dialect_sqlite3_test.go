// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSplitColStr(t *testing.T) {
	var kases = []struct {
		colStr string
		fields []string
	}{
		{
			colStr: "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL",
			fields: []string{
				"`id`", "INTEGER", "PRIMARY", "KEY", "AUTOINCREMENT", "NOT", "NULL",
			},
		},
		{
			colStr: "`created` DATETIME DEFAULT '2006-01-02 15:04:05' NULL",
			fields: []string{
				"`created`", "DATETIME", "DEFAULT", "'2006-01-02 15:04:05'", "NULL",
			},
		},
	}

	for _, kase := range kases {
		assert.EqualValues(t, kase.fields, splitColStr(kase.colStr))
	}
}
