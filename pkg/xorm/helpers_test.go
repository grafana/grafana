// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEraseAny(t *testing.T) {
	raw := "SELECT * FROM `table`.[table_name]"
	assert.EqualValues(t, raw, eraseAny(raw))
	assert.EqualValues(t, "SELECT * FROM table.[table_name]", eraseAny(raw, "`"))
	assert.EqualValues(t, "SELECT * FROM table.table_name", eraseAny(raw, "`", "[", "]"))
}

func TestQuoteColumns(t *testing.T) {
	cols := []string{"f1", "f2", "f3"}
	quoteFunc := func(value string) string {
		return "[" + value + "]"
	}

	assert.EqualValues(t, "[f1], [f2], [f3]", quoteColumns(cols, quoteFunc, ","))
}
