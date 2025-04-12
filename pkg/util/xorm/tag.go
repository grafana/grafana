// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm/core"
)

type tagContext struct {
	tagName         string
	params          []string
	preTag, nextTag string
	table           *core.Table
	col             *core.Column
	fieldValue      reflect.Value
	isIndex         bool
	isUnique        bool
	indexNames      map[string]int
	engine          *Engine
	ignoreNext      bool
}

// tagHandler describes tag handler for XORM
type tagHandler func(ctx *tagContext) error

var (
	// defaultTagHandlers enumerates all the default tag handler
	defaultTagHandlers = map[string]tagHandler{
		"<-":       OnlyFromDBTagHandler,
		"->":       OnlyToDBTagHandler,
		"PK":       PKTagHandler,
		"NULL":     NULLTagHandler,
		"NOT":      IgnoreTagHandler,
		"AUTOINCR": AutoIncrTagHandler,
		"DEFAULT":  DefaultTagHandler,
		"CREATED":  CreatedTagHandler,
		"UPDATED":  UpdatedTagHandler,
		"DELETED":  DeletedTagHandler,
		"VERSION":  VersionTagHandler,
		"UTC":      UTCTagHandler,
		"LOCAL":    LocalTagHandler,
		"NOTNULL":  NotNullTagHandler,
		"INDEX":    IndexTagHandler,
		"UNIQUE":   UniqueTagHandler,
		"COMMENT":  CommentTagHandler,
	}
)

func init() {
	for k := range core.SqlTypes {
		defaultTagHandlers[k] = SQLTypeTagHandler
	}
}

// IgnoreTagHandler describes ignored tag handler
func IgnoreTagHandler(ctx *tagContext) error {
	return nil
}

// OnlyFromDBTagHandler describes mapping direction tag handler
func OnlyFromDBTagHandler(ctx *tagContext) error {
	ctx.col.MapType = core.ONLYFROMDB
	return nil
}

// OnlyToDBTagHandler describes mapping direction tag handler
func OnlyToDBTagHandler(ctx *tagContext) error {
	ctx.col.MapType = core.ONLYTODB
	return nil
}

// PKTagHandler describes primary key tag handler
func PKTagHandler(ctx *tagContext) error {
	ctx.col.IsPrimaryKey = true
	ctx.col.Nullable = false
	return nil
}

// NULLTagHandler describes null tag handler
func NULLTagHandler(ctx *tagContext) error {
	ctx.col.Nullable = (strings.ToUpper(ctx.preTag) != "NOT")
	return nil
}

// NotNullTagHandler describes notnull tag handler
func NotNullTagHandler(ctx *tagContext) error {
	ctx.col.Nullable = false
	return nil
}

// AutoIncrTagHandler describes autoincr tag handler
func AutoIncrTagHandler(ctx *tagContext) error {
	ctx.col.IsAutoIncrement = true
	return nil
}

// DefaultTagHandler describes default tag handler
func DefaultTagHandler(ctx *tagContext) error {
	if len(ctx.params) > 0 {
		ctx.col.Default = ctx.params[0]
	} else {
		ctx.col.Default = ctx.nextTag
		ctx.ignoreNext = true
	}
	ctx.col.DefaultIsEmpty = false
	return nil
}

// CreatedTagHandler describes created tag handler
func CreatedTagHandler(ctx *tagContext) error {
	ctx.col.IsCreated = true
	return nil
}

// VersionTagHandler describes version tag handler
func VersionTagHandler(ctx *tagContext) error {
	ctx.col.IsVersion = true
	ctx.col.Default = "1"
	return nil
}

// UTCTagHandler describes utc tag handler
func UTCTagHandler(ctx *tagContext) error {
	ctx.col.TimeZone = time.UTC
	return nil
}

// LocalTagHandler describes local tag handler
func LocalTagHandler(ctx *tagContext) error {
	if len(ctx.params) == 0 {
		ctx.col.TimeZone = time.Local
	} else {
		var err error
		ctx.col.TimeZone, err = time.LoadLocation(ctx.params[0])
		if err != nil {
			return err
		}
	}
	return nil
}

// UpdatedTagHandler describes updated tag handler
func UpdatedTagHandler(ctx *tagContext) error {
	ctx.col.IsUpdated = true
	return nil
}

// DeletedTagHandler describes deleted tag handler
func DeletedTagHandler(ctx *tagContext) error {
	ctx.col.IsDeleted = true
	return nil
}

// IndexTagHandler describes index tag handler
func IndexTagHandler(ctx *tagContext) error {
	if len(ctx.params) > 0 {
		ctx.indexNames[ctx.params[0]] = core.IndexType
	} else {
		ctx.isIndex = true
	}
	return nil
}

// UniqueTagHandler describes unique tag handler
func UniqueTagHandler(ctx *tagContext) error {
	if len(ctx.params) > 0 {
		ctx.indexNames[ctx.params[0]] = core.UniqueType
	} else {
		ctx.isUnique = true
	}
	return nil
}

// CommentTagHandler add comment to column
func CommentTagHandler(ctx *tagContext) error {
	if len(ctx.params) > 0 {
		ctx.col.Comment = strings.Trim(ctx.params[0], "' ")
	}
	return nil
}

// SQLTypeTagHandler describes SQL Type tag handler
func SQLTypeTagHandler(ctx *tagContext) error {
	ctx.col.SQLType = core.SQLType{Name: ctx.tagName}
	if len(ctx.params) > 0 {
		if ctx.tagName == core.Enum {
			ctx.col.EnumOptions = make(map[string]int)
			for k, v := range ctx.params {
				v = strings.TrimSpace(v)
				v = strings.Trim(v, "'")
				ctx.col.EnumOptions[v] = k
			}
		} else if ctx.tagName == core.Set {
			ctx.col.SetOptions = make(map[string]int)
			for k, v := range ctx.params {
				v = strings.TrimSpace(v)
				v = strings.Trim(v, "'")
				ctx.col.SetOptions[v] = k
			}
		} else {
			var err error
			if len(ctx.params) == 2 {
				ctx.col.Length, err = strconv.Atoi(ctx.params[0])
				if err != nil {
					return err
				}
				ctx.col.Length2, err = strconv.Atoi(ctx.params[1])
				if err != nil {
					return err
				}
			} else if len(ctx.params) == 1 {
				ctx.col.Length, err = strconv.Atoi(ctx.params[0])
				if err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// ExtendsTagHandler describes extends tag handler
func ExtendsTagHandler(ctx *tagContext) error {
	var fieldValue = ctx.fieldValue
	var isPtr = false
	switch fieldValue.Kind() {
	case reflect.Ptr:
		f := fieldValue.Type().Elem()
		if f.Kind() == reflect.Struct {
			fieldPtr := fieldValue
			fieldValue = fieldValue.Elem()
			if !fieldValue.IsValid() || fieldPtr.IsNil() {
				fieldValue = reflect.New(f).Elem()
			}
		}
		isPtr = true
		fallthrough
	case reflect.Struct:
		parentTable, err := ctx.engine.mapType(fieldValue)
		if err != nil {
			return err
		}
		for _, col := range parentTable.Columns() {
			col.FieldName = fmt.Sprintf("%v.%v", ctx.col.FieldName, col.FieldName)

			var tagPrefix = ctx.col.FieldName
			if len(ctx.params) > 0 {
				col.Nullable = isPtr
				tagPrefix = ctx.params[0]
				if col.IsPrimaryKey {
					col.Name = ctx.col.FieldName
					col.IsPrimaryKey = false
				} else {
					col.Name = fmt.Sprintf("%v%v", tagPrefix, col.Name)
				}
			}

			if col.Nullable {
				col.IsAutoIncrement = false
				col.IsPrimaryKey = false
			}

			ctx.table.AddColumn(col)
			for indexName, indexType := range col.Indexes {
				addIndex(indexName, ctx.table, col, indexType)
			}
		}
	default:
		//TODO: warning
	}
	return nil
}
