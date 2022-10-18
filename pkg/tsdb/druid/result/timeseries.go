package result

import (
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type TimeseriesResult []TimeseriesRecord

// Frame returns data formatted as Grafana Frame.
func (t *TimeseriesResult) Frame() *data.Frame {
	columns := t.Columns()
	fields := make([]*data.Field, len(columns))
	for i, column := range columns {
		labels := data.Labels{}
		fields[i] = data.NewField(column, labels, t.Values(column))
	}
	return data.NewFrame("", fields...)
}

// Columns returns list of columns. It calls `Columns()` on first record. If
// no records are available it returns nil.
func (t *TimeseriesResult) Columns() []string {
	for _, r := range *t {
		return r.Columns()
	}
	return nil
}

// Values returns all values for given column.
func (t *TimeseriesResult) Values(column string) interface{} {
	if len(*t) == 0 {
		return nil
	}
	results := make([]interface{}, len(*t))
	for i, r := range *t {
		results[i] = r.Value(column)
	}
	return toTypedResults(results)
}

type TimeseriesRecord struct {
	Timestamp time.Time              `json:"timestamp"`
	Result    map[string]interface{} `json:"result"`
}

// Columns returns list of columns for given record.
// The first column will always be "timestamp" followed by other columns sorter
// alphabetically.
func (t *TimeseriesRecord) Columns() []string {
	columns := make([]string, len(t.Result)+1)
	columns[0] = timestampColumn
	i := 1
	for c := range t.Result {
		columns[i] = c
		i++
	}
	sort.Strings(columns[1:])
	return columns
}

// Value returns value for given column.
func (t *TimeseriesRecord) Value(column string) interface{} {
	if column == timestampColumn {
		return t.Timestamp
	}
	v, ok := t.Result[column]
	if !ok {
		return nil
	}
	return v
}
