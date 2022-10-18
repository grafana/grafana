package result

import (
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type TopNResult []TopNRecord

// Frame returns data formatted as Grafana Frame.
func (t *TopNResult) Frame() *data.Frame {
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
func (t *TopNResult) Columns() []string {
	for _, r := range *t {
		return r.Columns()
	}
	return nil
}

// Values returns all values for given column.
func (t *TopNResult) Values(column string) interface{} {
	results := []interface{}{}
	for _, r := range *t {
		results = append(results, r.Values(column)...)
	}
	return toTypedResults(results)
}

type TopNRecord struct {
	Timestamp time.Time                `json:"timestamp"`
	Result    []map[string]interface{} `json:"result"`
}

// Columns returns list of columns for given record.
// It assumes that every map from Result has the same columns, so it gets
// the list from first item.
// The first column will always be "timestamp" followed by other columns sorter
// alphabetically.
func (t *TopNRecord) Columns() []string {
	for _, result := range t.Result {
		columns := make([]string, len(result)+1)
		columns[0] = timestampColumn
		i := 1
		for c := range result {
			columns[i] = c
			i++
		}
		sort.Strings(columns[1:])
		return columns
	}
	return nil
}

// Value returns values for given column.
func (t *TopNRecord) Values(column string) []interface{} {
	values := []interface{}{}
	for _, result := range t.Result {
		if column == timestampColumn {
			values = append(values, t.Timestamp)
			continue
		}
		v, _ := result[column]
		values = append(values, v)
	}
	return values
}
