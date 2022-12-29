// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	"xorm.io/builder"
	"xorm.io/core"
)

func quoteNeeded(a interface{}) bool {
	switch a.(type) {
	case int, int8, int16, int32, int64:
		return false
	case uint, uint8, uint16, uint32, uint64:
		return false
	case float32, float64:
		return false
	case bool:
		return false
	case string:
		return true
	case time.Time, *time.Time:
		return true
	case builder.Builder, *builder.Builder:
		return false
	}

	t := reflect.TypeOf(a)
	switch t.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return false
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return false
	case reflect.Float32, reflect.Float64:
		return false
	case reflect.Bool:
		return false
	case reflect.String:
		return true
	}

	return true
}

func convertStringSingleQuote(arg string) string {
	return "'" + strings.Replace(arg, "'", "''", -1) + "'"
}

func convertString(arg string) string {
	var buf strings.Builder
	buf.WriteRune('\'')
	for _, c := range arg {
		if c == '\\' || c == '\'' {
			buf.WriteRune('\\')
		}
		buf.WriteRune(c)
	}
	buf.WriteRune('\'')
	return buf.String()
}

func convertArg(arg interface{}, convertFunc func(string) string) string {
	if quoteNeeded(arg) {
		argv := fmt.Sprintf("%v", arg)
		return convertFunc(argv)
	}

	return fmt.Sprintf("%v", arg)
}

const insertSelectPlaceHolder = true

func (statement *Statement) writeArg(w *builder.BytesWriter, arg interface{}) error {
	switch argv := arg.(type) {
	case bool:
		if argv {
			if _, err := w.WriteString("true"); err != nil {
				return err
			}
		} else {
			if _, err := w.WriteString("false"); err != nil {
				return err
			}
		}
	case *builder.Builder:
		if _, err := w.WriteString("("); err != nil {
			return err
		}
		if err := argv.WriteTo(w); err != nil {
			return err
		}
		if _, err := w.WriteString(")"); err != nil {
			return err
		}
	default:
		if insertSelectPlaceHolder {
			if err := w.WriteByte('?'); err != nil {
				return err
			}
			w.Append(arg)
		} else {
			var convertFunc = convertStringSingleQuote
			if statement.Engine.dialect.DBType() == core.MYSQL {
				convertFunc = convertString
			}
			if _, err := w.WriteString(convertArg(arg, convertFunc)); err != nil {
				return err
			}
		}
	}
	return nil
}

func (statement *Statement) writeArgs(w *builder.BytesWriter, args []interface{}) error {
	for i, arg := range args {
		if err := statement.writeArg(w, arg); err != nil {
			return err
		}

		if i+1 != len(args) {
			if _, err := w.WriteString(","); err != nil {
				return err
			}
		}
	}
	return nil
}

func writeStrings(w *builder.BytesWriter, cols []string, leftQuote, rightQuote string) error {
	for i, colName := range cols {
		if len(leftQuote) > 0 && colName[0] != '`' {
			if _, err := w.WriteString(leftQuote); err != nil {
				return err
			}
		}
		if _, err := w.WriteString(colName); err != nil {
			return err
		}
		if len(rightQuote) > 0 && colName[len(colName)-1] != '`' {
			if _, err := w.WriteString(rightQuote); err != nil {
				return err
			}
		}
		if i+1 != len(cols) {
			if _, err := w.WriteString(","); err != nil {
				return err
			}
		}
	}
	return nil
}
