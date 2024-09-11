package sqltemplate

import (
	"fmt"
	"reflect"
)

type ScanDest struct {
	values   []any
	colNames []string
}

func (i *ScanDest) Into(v reflect.Value, colName string) (string, error) {
	if !v.IsValid() || !v.CanAddr() || !v.Addr().CanInterface() {
		return "", fmt.Errorf("invalid or unaddressable value: %v", colName)
	}

	i.values = append(i.values, v.Addr().Interface())
	i.colNames = append(i.colNames, colName)

	return colName, nil
}

func (i *ScanDest) Reset() {
	i.values = nil
}

func (i *ScanDest) GetScanDest() []any {
	return i.values
}

func (i *ScanDest) GetColNames() []string {
	return i.colNames
}

type ScanDestIface interface {
	Into(v reflect.Value, colName string) (string, error)
	GetScanDest() []any
	GetColNames() []string
	Reset()
}
