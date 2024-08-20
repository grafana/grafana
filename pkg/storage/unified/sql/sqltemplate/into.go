package sqltemplate

import (
	"fmt"
	"reflect"
)

type scanDest struct {
	values   []any
	colNames []string
}

func (i *scanDest) Into(v reflect.Value, colName string) (string, error) {
	if !v.IsValid() || !v.CanAddr() || !v.Addr().CanInterface() {
		return "", fmt.Errorf("invalid or unaddressable value: %v", colName)
	}

	i.values = append(i.values, v.Addr().Interface())
	i.colNames = append(i.colNames, colName)

	return colName, nil
}

func (i *scanDest) Reset() {
	i.values = nil
}

func (i *scanDest) GetScanDest() []any {
	return i.values
}

func (i *scanDest) GetColNames() []string {
	return i.colNames
}

type ScanDest interface {
	Into(v reflect.Value, colName string) (string, error)
	GetScanDest() []any
	GetColNames() []string
	Reset()
}
