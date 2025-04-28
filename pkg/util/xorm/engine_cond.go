// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql/driver"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm/core"
	"xorm.io/builder"
)

func (engine *Engine) buildConds(table *core.Table, bean any,
	includeVersion bool, includeUpdated bool, includeNil bool,
	includeAutoIncr bool, allUseBool bool, useAllCols bool, unscoped bool,
	mustColumnMap map[string]bool, tableName, aliasName string, addedTableName bool) (builder.Cond, error) {
	var conds []builder.Cond
	for _, col := range table.Columns() {
		if !includeVersion && col.IsVersion {
			continue
		}
		if !includeUpdated && col.IsUpdated {
			continue
		}
		if !includeAutoIncr && col.IsAutoIncrement {
			continue
		}

		if col.SQLType.IsJson() {
			continue
		}

		var colName string
		if addedTableName {
			var nm = tableName
			if len(aliasName) > 0 {
				nm = aliasName
			}
			colName = engine.Quote(nm) + "." + engine.Quote(col.Name)
		} else {
			colName = engine.Quote(col.Name)
		}

		fieldValuePtr, err := col.ValueOf(bean)
		if err != nil {
			if !strings.Contains(err.Error(), "is not valid") {
				engine.logger.Warn(err)
			}
			continue
		}

		if col.IsDeleted && !unscoped { // tag "deleted" is enabled
			conds = append(conds, engine.CondDeleted(col))
		}

		fieldValue := *fieldValuePtr
		if fieldValue.Interface() == nil {
			continue
		}

		fieldType := reflect.TypeOf(fieldValue.Interface())
		requiredField := useAllCols

		if b, ok := getFlagForColumn(mustColumnMap, col); ok {
			if b {
				requiredField = true
			} else {
				continue
			}
		}

		if fieldType.Kind() == reflect.Ptr {
			if fieldValue.IsNil() {
				if includeNil {
					conds = append(conds, builder.Eq{colName: nil})
				}
				continue
			} else if !fieldValue.IsValid() {
				continue
			} else {
				// dereference ptr type to instance type
				fieldValue = fieldValue.Elem()
				fieldType = reflect.TypeOf(fieldValue.Interface())
				requiredField = true
			}
		}

		var val any
		switch fieldType.Kind() {
		case reflect.Bool:
			if allUseBool || requiredField {
				val = fieldValue.Interface()
			} else {
				// if a bool in a struct, it will not be as a condition because it default is false,
				// please use Where() instead
				continue
			}
		case reflect.String:
			if !requiredField && fieldValue.String() == "" {
				continue
			}
			// for MyString, should convert to string or panic
			if fieldType.String() != reflect.String.String() {
				val = fieldValue.String()
			} else {
				val = fieldValue.Interface()
			}
		case reflect.Int8, reflect.Int16, reflect.Int, reflect.Int32, reflect.Int64:
			if !requiredField && fieldValue.Int() == 0 {
				continue
			}
			val = fieldValue.Interface()
		case reflect.Float32, reflect.Float64:
			if !requiredField && fieldValue.Float() == 0.0 {
				continue
			}
			val = fieldValue.Interface()
		case reflect.Uint8, reflect.Uint16, reflect.Uint, reflect.Uint32, reflect.Uint64:
			if !requiredField && fieldValue.Uint() == 0 {
				continue
			}
			t := int64(fieldValue.Uint())
			val = reflect.ValueOf(&t).Interface()
		case reflect.Struct:
			if fieldType.ConvertibleTo(core.TimeType) {
				t := fieldValue.Convert(core.TimeType).Interface().(time.Time)
				if !requiredField && (t.IsZero() || !fieldValue.IsValid()) {
					continue
				}
				val = engine.formatColTime(col, t)
			} else if _, ok := reflect.New(fieldType).Interface().(core.Conversion); ok {
				continue
			} else if valNul, ok := fieldValue.Interface().(driver.Valuer); ok {
				val, _ = valNul.Value()
				if val == nil {
					continue
				}
			} else {
				if col.SQLType.IsJson() {
					if col.SQLType.IsText() {
						bytes, err := DefaultJSONHandler.Marshal(fieldValue.Interface())
						if err != nil {
							engine.logger.Error(err)
							continue
						}
						val = string(bytes)
					} else if col.SQLType.IsBlob() {
						var bytes []byte
						var err error
						bytes, err = DefaultJSONHandler.Marshal(fieldValue.Interface())
						if err != nil {
							engine.logger.Error(err)
							continue
						}
						val = bytes
					}
				} else {
					engine.autoMapType(fieldValue)
					if table, ok := engine.Tables[fieldValue.Type()]; ok {
						if len(table.PrimaryKeys) == 1 {
							pkField := reflect.Indirect(fieldValue).FieldByName(table.PKColumns()[0].FieldName)
							// fix non-int pk issues
							//if pkField.Int() != 0 {
							if pkField.IsValid() && !isZero(pkField.Interface()) {
								val = pkField.Interface()
							} else {
								continue
							}
						} else {
							//TODO: how to handler?
							return nil, fmt.Errorf("not supported %v as %v", fieldValue.Interface(), table.PrimaryKeys)
						}
					} else {
						val = fieldValue.Interface()
					}
				}
			}
		case reflect.Array:
			continue
		case reflect.Slice, reflect.Map:
			if fieldValue == reflect.Zero(fieldType) {
				continue
			}
			if fieldValue.IsNil() || !fieldValue.IsValid() || fieldValue.Len() == 0 {
				continue
			}

			if col.SQLType.IsText() {
				bytes, err := DefaultJSONHandler.Marshal(fieldValue.Interface())
				if err != nil {
					engine.logger.Error(err)
					continue
				}
				val = string(bytes)
			} else if col.SQLType.IsBlob() {
				var bytes []byte
				var err error
				if (fieldType.Kind() == reflect.Array || fieldType.Kind() == reflect.Slice) &&
					fieldType.Elem().Kind() == reflect.Uint8 {
					if fieldValue.Len() > 0 {
						val = fieldValue.Bytes()
					} else {
						continue
					}
				} else {
					bytes, err = DefaultJSONHandler.Marshal(fieldValue.Interface())
					if err != nil {
						engine.logger.Error(err)
						continue
					}
					val = bytes
				}
			} else {
				continue
			}
		default:
			val = fieldValue.Interface()
		}

		conds = append(conds, builder.Eq{colName: val})
	}

	return builder.And(conds...), nil
}
