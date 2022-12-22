// Copyright 2020 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"

	"xorm.io/core"
)

type TestTableNameStruct struct{}

func (t *TestTableNameStruct) TableName() string {
	return "my_test_table_name_struct"
}

func TestGetTableName(t *testing.T) {
	var kases = []struct {
		mapper            core.IMapper
		v                 reflect.Value
		expectedTableName string
	}{
		{
			core.SnakeMapper{},
			reflect.ValueOf(new(Userinfo)),
			"userinfo",
		},
		{
			core.SnakeMapper{},
			reflect.ValueOf(Userinfo{}),
			"userinfo",
		},
		{
			core.SameMapper{},
			reflect.ValueOf(new(Userinfo)),
			"Userinfo",
		},
		{
			core.SameMapper{},
			reflect.ValueOf(Userinfo{}),
			"Userinfo",
		},
		{
			core.SnakeMapper{},
			reflect.ValueOf(new(MyGetCustomTableImpletation)),
			getCustomTableName,
		},
		{
			core.SnakeMapper{},
			reflect.ValueOf(MyGetCustomTableImpletation{}),
			getCustomTableName,
		},
		{
			core.SnakeMapper{},
			reflect.ValueOf(MyGetCustomTableImpletation{}),
			getCustomTableName,
		},
		{
			core.SnakeMapper{},
			reflect.ValueOf(new(TestTableNameStruct)),
			new(TestTableNameStruct).TableName(),
		},
	}

	for _, kase := range kases {
		assert.EqualValues(t, kase.expectedTableName, getTableName(kase.mapper, kase.v))
	}
}
