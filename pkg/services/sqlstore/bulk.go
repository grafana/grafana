package sqlstore

import (
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type BulkOpSettings struct {
	BatchSize int
}

func NativeSettingsForDialect(d migrator.Dialect) BulkOpSettings {
	return BulkOpSettings{
		BatchSize: d.BatchSize(),
	}
}

func Test() {
	s := &DBSession{}
	records := []int{1, 2, 3}
	s.BulkInsert(1, BulkOpSettings{}, records...)
}

func (sess *DBSession) BulkInsert(table interface{}, opts BulkOpSettings, records ...any) {
	sess.Table(table).InsertMulti(records)
}

func inBatches(items interface{}, size int, fn func(batch []interface{}) error) error {
	t := reflect.ValueOf(items)
	if t.Kind() != reflect.Slice {
		return fmt.Errorf("cannot batch records on a non-slice")
	}
	return nil
}
