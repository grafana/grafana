// Copyright 2018 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"reflect"
	"strings"

	"xorm.io/core"
)

// tbNameWithSchema will automatically add schema prefix on table name
func (engine *Engine) tbNameWithSchema(v string) string {
	// Add schema name as prefix of table name.
	// Only for postgres database.
	if engine.dialect.DBType() == core.POSTGRES &&
		engine.dialect.URI().Schema != "" &&
		engine.dialect.URI().Schema != postgresPublicSchema &&
		!strings.Contains(v, ".") {
		return engine.dialect.URI().Schema + "." + v
	}
	return v
}

func isSubQuery(tbName string) bool {
	const selStr = "select"
	if len(tbName) <= len(selStr)+1 {
		return false
	}

	return strings.EqualFold(tbName[:len(selStr)], selStr) || strings.EqualFold(tbName[:len(selStr)+1], "("+selStr)
}

// TableName returns table name with schema prefix if has
func (engine *Engine) TableName(bean interface{}, includeSchema ...bool) string {
	tbName := engine.tbNameNoSchema(bean)
	if len(includeSchema) > 0 && includeSchema[0] && !isSubQuery(tbName) {
		tbName = engine.tbNameWithSchema(tbName)
	}
	return tbName
}

func (engine *Engine) tbNameNoSchema(tablename interface{}) string {
	switch tablename.(type) {
	case []string:
		t := tablename.([]string)
		if len(t) > 1 {
			return fmt.Sprintf("%v AS %v", engine.Quote(t[0]), engine.Quote(t[1]))
		} else if len(t) == 1 {
			return engine.Quote(t[0])
		}
	case []interface{}:
		t := tablename.([]interface{})
		l := len(t)
		var table string
		if l > 0 {
			f := t[0]
			switch f.(type) {
			case string:
				table = f.(string)
			case TableName:
				table = f.(TableName).TableName()
			default:
				v := rValue(f)
				t := v.Type()
				if t.Kind() == reflect.Struct {
					table = getTableName(engine.TableMapper, v)
				} else {
					table = engine.Quote(fmt.Sprintf("%v", f))
				}
			}
		}
		if l > 1 {
			return fmt.Sprintf("%v AS %v", engine.Quote(table),
				engine.Quote(fmt.Sprintf("%v", t[1])))
		} else if l == 1 {
			return engine.Quote(table)
		}
	case TableName:
		return tablename.(TableName).TableName()
	case string:
		return tablename.(string)
	case reflect.Value:
		v := tablename.(reflect.Value)
		return getTableName(engine.TableMapper, v)
	default:
		v := rValue(tablename)
		t := v.Type()
		if t.Kind() == reflect.Struct {
			return getTableName(engine.TableMapper, v)
		}
		return engine.Quote(fmt.Sprintf("%v", tablename))
	}
	return ""
}
