package sqltemplate

import (
	"fmt"
	"reflect"
)

type ScanDest struct {
	values []any
}

func (i *ScanDest) Into(v reflect.Value, colName string) (string, error) {
	if !v.IsValid() || !v.CanAddr() || !v.Addr().CanInterface() {
		return "", fmt.Errorf("invalid or unaddressable value: %v", colName)
	}

	i.values = append(i.values, v.Addr().Interface())

	return colName, nil
}

func (i *ScanDest) GetScanDest() []any {
	return i.values
}

type ScanDestIface interface {
	Into(v reflect.Value, colName string) (string, error)
	GetScanDest() []any
}
