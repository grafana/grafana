package sqltemplate

import (
	"fmt"
	"reflect"
)

type ScanDest []any

func (i *ScanDest) Into(v reflect.Value, colName string) (string, error) {
	if !v.IsValid() || !v.CanAddr() || !v.Addr().CanInterface() {
		return "", fmt.Errorf("invalid or unaddressable value: %v", colName)
	}

	*i = append(*i, v.Addr().Interface())

	return colName, nil
}

func (i *ScanDest) GetScanDest() ScanDest {
	return *i
}

type ScanDestIface interface {
	Into(v reflect.Value, colName string) (string, error)
	GetScanDest() ScanDest
}
