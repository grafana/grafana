package mocks

import (
	"reflect"
	"testing"

	mock "github.com/stretchr/testify/mock"
)

func NewRowWithValues(t *testing.T, values ...any) *Row {
	row := NewRow(t)
	row.EXPECT().Err().Return(nil).Once() // should check error
	ExpectRowValues(t, row, values...)
	return row
}

func ExpectRowValues(t *testing.T, row *Row, values ...any) *Row_Scan_Call {
	return row.EXPECT().Scan(mock.Anything).RunAndReturn(func(dsts ...any) error {
		scan(t, dsts, values)
		return nil
	})
}

func scan(t *testing.T, dsts, srcs []any) {
	t.Helper()
	if len(dsts) > len(srcs) {
		t.Fatalf("%d destination values, but only %d source values", len(dsts),
			len(srcs))
		return
	}

	for i := range dsts {
		src := reflect.ValueOf(srcs[i])
		if !src.IsValid() {
			t.Fatalf("%d-eth value to be returned by the mocked db is"+
				" invalid: %#v", i, srcs[i])
			return
		}

		dst := reflect.ValueOf(dsts[i])
		if !dst.IsValid() || dst.Kind() != reflect.Pointer {
			t.Fatalf("%d-eth argument passed to Scan is invalid or not"+
				" a pointer: %#v", i, dsts[i])
			return
		}

		dst = dst.Elem() // get element to which the pointer points to
		if !dst.CanSet() || !src.Type().AssignableTo(dst.Type()) {
			t.Fatalf("%d-eth destination cannot be set, orcannot be assigned "+
				"the value; type of destination: %T; value that would be "+
				"assigned: %#v", i, dsts[i], srcs[i])
			return
		}
		dst.Set(src)
	}
}
