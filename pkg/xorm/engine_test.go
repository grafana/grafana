// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestQuoteTo(t *testing.T) {

	test := func(t *testing.T, expected string, value string) {
		buf := &strings.Builder{}
		quoteTo(buf, "[]", value)
		assert.EqualValues(t, expected, buf.String())
	}

	test(t, "[mytable]", "mytable")
	test(t, "[mytable]", "`mytable`")
	test(t, "[mytable]", `[mytable]`)

	test(t, `["mytable"]`, `"mytable"`)

	test(t, "[myschema].[mytable]", "myschema.mytable")
	test(t, "[myschema].[mytable]", "`myschema`.mytable")
	test(t, "[myschema].[mytable]", "myschema.`mytable`")
	test(t, "[myschema].[mytable]", "`myschema`.`mytable`")
	test(t, "[myschema].[mytable]", `[myschema].mytable`)
	test(t, "[myschema].[mytable]", `myschema.[mytable]`)
	test(t, "[myschema].[mytable]", `[myschema].[mytable]`)

	test(t, `["myschema].[mytable"]`, `"myschema.mytable"`)

	buf := &strings.Builder{}
	quoteTo(buf, "", "noquote")
	assert.EqualValues(t, "noquote", buf.String())
}
