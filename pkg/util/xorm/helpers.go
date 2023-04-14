// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"reflect"
	"sort"
	"strings"
)

type zeroable interface {
	IsZero() bool
}

func isZero(k interface{}) bool {
	switch k.(type) {
	case int:
		return k.(int) == 0
	case int8:
		return k.(int8) == 0
	case int16:
		return k.(int16) == 0
	case int32:
		return k.(int32) == 0
	case int64:
		return k.(int64) == 0
	case uint:
		return k.(uint) == 0
	case uint8:
		return k.(uint8) == 0
	case uint16:
		return k.(uint16) == 0
	case uint32:
		return k.(uint32) == 0
	case uint64:
		return k.(uint64) == 0
	case float32:
		return k.(float32) == 0
	case float64:
		return k.(float64) == 0
	case bool:
		return k.(bool) == false
	case string:
		return k.(string) == ""
	case zeroable:
		return k.(zeroable).IsZero()
	}
	return false
}

func isZeroValue(v reflect.Value) bool {
	if isZero(v.Interface()) {
		return true
	}
	switch v.Kind() {
	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Ptr, reflect.Slice:
		return v.IsNil()
	}
	return false
}

func isStructZero(v reflect.Value) bool {
	if !v.IsValid() {
		return true
	}

	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)
		switch field.Kind() {
		case reflect.Ptr:
			field = field.Elem()
			fallthrough
		case reflect.Struct:
			if !isStructZero(field) {
				return false
			}
		default:
			if field.CanInterface() && !isZero(field.Interface()) {
				return false
			}
		}
	}
	return true
}

func splitTag(tag string) (tags []string) {
	tag = strings.TrimSpace(tag)
	var hasQuote = false
	var lastIdx = 0
	for i, t := range tag {
		if t == '\'' {
			hasQuote = !hasQuote
		} else if t == ' ' {
			if lastIdx < i && !hasQuote {
				tags = append(tags, strings.TrimSpace(tag[lastIdx:i]))
				lastIdx = i + 1
			}
		}
	}
	if lastIdx < len(tag) {
		tags = append(tags, strings.TrimSpace(tag[lastIdx:]))
	}
	return
}

func isArrayValueZero(v reflect.Value) bool {
	if !v.IsValid() || v.Len() == 0 {
		return true
	}

	for i := 0; i < v.Len(); i++ {
		if !isZero(v.Index(i).Interface()) {
			return false
		}
	}

	return true
}

func int64ToIntValue(id int64, tp reflect.Type) reflect.Value {
	var v interface{}
	kind := tp.Kind()

	if kind == reflect.Ptr {
		kind = tp.Elem().Kind()
	}

	switch kind {
	case reflect.Int16:
		temp := int16(id)
		v = &temp
	case reflect.Int32:
		temp := int32(id)
		v = &temp
	case reflect.Int:
		temp := int(id)
		v = &temp
	case reflect.Int64:
		temp := id
		v = &temp
	case reflect.Uint16:
		temp := uint16(id)
		v = &temp
	case reflect.Uint32:
		temp := uint32(id)
		v = &temp
	case reflect.Uint64:
		temp := uint64(id)
		v = &temp
	case reflect.Uint:
		temp := uint(id)
		v = &temp
	}

	if tp.Kind() == reflect.Ptr {
		return reflect.ValueOf(v).Convert(tp)
	}
	return reflect.ValueOf(v).Elem().Convert(tp)
}

func int64ToInt(id int64, tp reflect.Type) interface{} {
	return int64ToIntValue(id, tp).Interface()
}

func rValue(bean interface{}) reflect.Value {
	return reflect.Indirect(reflect.ValueOf(bean))
}

func sliceEq(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	sort.Sort(sort.StringSlice(left))
	sort.Sort(sort.StringSlice(right))
	for i := 0; i < len(left); i++ {
		if left[i] != right[i] {
			return false
		}
	}
	return true
}

func indexName(tableName, idxName string) string {
	return fmt.Sprintf("IDX_%v_%v", tableName, idxName)
}

func eraseAny(value string, strToErase ...string) string {
	if len(strToErase) == 0 {
		return value
	}
	var replaceSeq []string
	for _, s := range strToErase {
		replaceSeq = append(replaceSeq, s, "")
	}

	replacer := strings.NewReplacer(replaceSeq...)

	return replacer.Replace(value)
}

func quoteColumns(cols []string, quoteFunc func(string) string, sep string) string {
	for i := range cols {
		cols[i] = quoteFunc(cols[i])
	}
	return strings.Join(cols, sep+" ")
}
