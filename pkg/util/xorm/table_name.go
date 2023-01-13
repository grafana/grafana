// Copyright 2020 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"reflect"

	"xorm.io/core"
)

func getTableName(mapper core.IMapper, v reflect.Value) string {
	if t, ok := v.Interface().(TableName); ok {
		return t.TableName()
	}
	if v.Type().Implements(tpTableName) {
		return v.Interface().(TableName).TableName()
	}
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
		if t, ok := v.Interface().(TableName); ok {
			return t.TableName()
		}
		if v.Type().Implements(tpTableName) {
			return v.Interface().(TableName).TableName()
		}
	}

	return mapper.Obj2Table(v.Type().Name())
}
