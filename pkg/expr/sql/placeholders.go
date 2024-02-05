//go:build sqlexpressions
// +build sqlexpressions

package sql

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// workround - temporary until new DuckDB driver is released - update null placeholders to null
func (d *DuckDB) updateNullPlaceholders(nullFields Fields) error {
	var stmts []string
	for k, ff := range nullFields {
		ref := strings.Split(k, "|")[0]
		ph := placeholder(ff)
		phVal := ""
		switch v := ph.(type) {
		case float64, float32:
			phVal = fmt.Sprintf("%f", v)
		case int, int16, int32, int64, uint, uint16, uint32, uint64:
			phVal = fmt.Sprintf("%f", v)
		case time.Time:
			phVal = v.String()
		default:
			phVal = fmt.Sprintf("%s", v)
		}
		stmts = append(stmts, fmt.Sprintf(`update %s set "%s" = NULL where "%s" = %s`, ref, ff.Name, ff.Name, phVal))
	}
	if len(stmts) > 0 {
		sql := strings.Join(stmts, ";")
		res, err := d.db.Query(sql)
		if err != nil {
			fmt.Println(err)
			return err
		}
		err = res.Close()
		if err != nil {
			fmt.Println(err)
		}
	}
	return nil
}

func placeholder(f *data.Field) any {
	return placeholders[f.Type()]
}

const (
	FloatPlaceholder  = -1.12345
	IntPlaceholder    = 12345
	StringPlaceholder = `¯\_(ツ)_/¯`
)

var TimePlaceholder = time.Time{}

var placeholders = map[data.FieldType]any{
	data.FieldTypeFloat64:         FloatPlaceholder,
	data.FieldTypeFloat32:         FloatPlaceholder,
	data.FieldTypeInt16:           IntPlaceholder,
	data.FieldTypeInt64:           IntPlaceholder,
	data.FieldTypeInt8:            IntPlaceholder,
	data.FieldTypeUint8:           IntPlaceholder,
	data.FieldTypeUint16:          IntPlaceholder,
	data.FieldTypeUint32:          IntPlaceholder,
	data.FieldTypeUint64:          IntPlaceholder,
	data.FieldTypeNullableFloat64: FloatPlaceholder,
	data.FieldTypeNullableFloat32: FloatPlaceholder,
	data.FieldTypeNullableInt16:   IntPlaceholder,
	data.FieldTypeNullableInt64:   IntPlaceholder,
	data.FieldTypeNullableInt8:    IntPlaceholder,
	data.FieldTypeNullableUint8:   IntPlaceholder,
	data.FieldTypeNullableUint16:  IntPlaceholder,
	data.FieldTypeNullableUint32:  IntPlaceholder,
	data.FieldTypeNullableUint64:  IntPlaceholder,
	data.FieldTypeString:          StringPlaceholder,
	data.FieldTypeNullableString:  StringPlaceholder,
	data.FieldTypeTime:            TimePlaceholder,
	data.FieldTypeNullableTime:    TimePlaceholder,
}
