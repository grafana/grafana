package sqlstore

import (
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const DefaultBatchSize = 1000

type BulkOpSettings struct {
	BatchSize int
}

func NativeSettingsForDialect(d migrator.Dialect) BulkOpSettings {
	return BulkOpSettings{
		BatchSize: d.BatchSize(),
	}
}

func normalizeBulkSettings(s BulkOpSettings) BulkOpSettings {
	if s.BatchSize < 1 {
		sessionLogger.Debug("Invalid batch size, falling back to the default", "requested", s.BatchSize, "actual", DefaultBatchSize)
		s.BatchSize = DefaultBatchSize
	}
	return s
}

func (sess *DBSession) BulkInsert(table interface{}, recordsSlice interface{}, opts BulkOpSettings) (int64, error) {
	var inserted int64
	err := InBatches(recordsSlice, opts, func(batch interface{}) error {
		a, err := sess.Table(table).InsertMulti(batch)
		inserted += a
		return err
	})
	return inserted, err
}

func InBatches(items interface{}, opts BulkOpSettings, fn func(batch interface{}) error) error {
	opts = normalizeBulkSettings(opts)
	slice := reflect.Indirect(reflect.ValueOf(items))
	if slice.Kind() != reflect.Slice {
		return fmt.Errorf("need a slice of objects in order to batch")
	}

	for i := 0; i < slice.Len(); i += opts.BatchSize {
		end := i + opts.BatchSize
		if end > slice.Len() {
			end = slice.Len()
		}

		chunk := slice.Slice(i, end).Interface()

		if err := fn(chunk); err != nil {
			return err
		}
	}
	return nil
}
