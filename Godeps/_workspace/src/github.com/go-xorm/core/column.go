package core

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
)

const (
	TWOSIDES = iota + 1
	ONLYTODB
	ONLYFROMDB
)

// database column
type Column struct {
	Name            string
	FieldName       string
	SQLType         SQLType
	Length          int
	Length2         int
	Nullable        bool
	Default         string
	Indexes         map[string]bool
	IsPrimaryKey    bool
	IsAutoIncrement bool
	MapType         int
	IsCreated       bool
	IsUpdated       bool
	IsDeleted       bool
	IsCascade       bool
	IsVersion       bool
	fieldPath       []string
	DefaultIsEmpty  bool
	EnumOptions     map[string]int
	SetOptions      map[string]int
}

func NewColumn(name, fieldName string, sqlType SQLType, len1, len2 int, nullable bool) *Column {
	return &Column{
		Name:            name,
		FieldName:       fieldName,
		SQLType:         sqlType,
		Length:          len1,
		Length2:         len2,
		Nullable:        nullable,
		Default:         "",
		Indexes:         make(map[string]bool),
		IsPrimaryKey:    false,
		IsAutoIncrement: false,
		MapType:         TWOSIDES,
		IsCreated:       false,
		IsUpdated:       false,
		IsDeleted:       false,
		IsCascade:       false,
		IsVersion:       false,
		fieldPath:       nil,
		DefaultIsEmpty:  false,
		EnumOptions:     make(map[string]int),
	}
}

// generate column description string according dialect
func (col *Column) String(d Dialect) string {
	sql := d.QuoteStr() + col.Name + d.QuoteStr() + " "

	sql += d.SqlType(col) + " "

	if col.IsPrimaryKey {
		sql += "PRIMARY KEY "
		if col.IsAutoIncrement {
			sql += d.AutoIncrStr() + " "
		}
	}

	if d.ShowCreateNull() {
		if col.Nullable {
			sql += "NULL "
		} else {
			sql += "NOT NULL "
		}
	}

	if col.Default != "" {
		sql += "DEFAULT " + col.Default + " "
	}

	return sql
}

func (col *Column) StringNoPk(d Dialect) string {
	sql := d.QuoteStr() + col.Name + d.QuoteStr() + " "

	sql += d.SqlType(col) + " "

	if d.ShowCreateNull() {
		if col.Nullable {
			sql += "NULL "
		} else {
			sql += "NOT NULL "
		}
	}

	if col.Default != "" {
		sql += "DEFAULT " + col.Default + " "
	}

	return sql
}

// return col's filed of struct's value
func (col *Column) ValueOf(bean interface{}) (*reflect.Value, error) {
	dataStruct := reflect.Indirect(reflect.ValueOf(bean))
	return col.ValueOfV(&dataStruct)
}

func (col *Column) ValueOfV(dataStruct *reflect.Value) (*reflect.Value, error) {
	var fieldValue reflect.Value
	if col.fieldPath == nil {
		col.fieldPath = strings.Split(col.FieldName, ".")
	}

	if dataStruct.Type().Kind() == reflect.Map {
		var keyValue reflect.Value

		if len(col.fieldPath) == 1 {
			keyValue = reflect.ValueOf(col.FieldName)
		} else if len(col.fieldPath) == 2 {
			keyValue = reflect.ValueOf(col.fieldPath[1])
		} else {
			return nil, fmt.Errorf("Unsupported mutliderive %v", col.FieldName)
		}

		fieldValue = dataStruct.MapIndex(keyValue)
		return &fieldValue, nil
	}

	if len(col.fieldPath) == 1 {
		fieldValue = dataStruct.FieldByName(col.FieldName)
	} else if len(col.fieldPath) == 2 {
		parentField := dataStruct.FieldByName(col.fieldPath[0])
		if parentField.IsValid() {
			if parentField.Kind() == reflect.Struct {
				fieldValue = parentField.FieldByName(col.fieldPath[1])
			} else if parentField.Kind() == reflect.Ptr {
				if parentField.IsNil() {
					parentField.Set(reflect.New(parentField.Type().Elem()))
					fieldValue = parentField.Elem().FieldByName(col.fieldPath[1])
				} else {
					parentField = parentField.Elem()
					if parentField.IsValid() {
						fieldValue = parentField.FieldByName(col.fieldPath[1])
					} else {
						return nil, fmt.Errorf("field  %v is not valid", col.FieldName)
					}
				}
			}
		} else {
			// so we can use a different struct as conditions
			fieldValue = dataStruct.FieldByName(col.fieldPath[1])
		}
	} else {
		return nil, fmt.Errorf("Unsupported mutliderive %v", col.FieldName)
	}

	if !fieldValue.IsValid() {
		return nil, errors.New("no find field matched")
	}

	return &fieldValue, nil
}
