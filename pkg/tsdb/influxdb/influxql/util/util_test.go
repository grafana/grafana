package util

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

func TestParseString(t *testing.T) {
	t.Run("parse bool value to string", func(t *testing.T) {
		val := true
		expected := ToPtr("true")
		result := ParseString(val)
		require.Equal(t, expected, result)
	})

	t.Run("parse number value to string", func(t *testing.T) {
		val := 123
		expected := ToPtr("123")
		result := ParseString(val)
		require.Equal(t, expected, result)
	})
}

func TestFormatFrameName(t *testing.T) {
	testcases := []struct {
		name     string
		rowName  string
		column   string
		tags     map[string]string
		query    models.Query
		expected string
	}{
		{name: "no alias", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "", ResultFormat: "time_series"}, expected: "rowName.colName { key: value }"},
		{name: "simple alias", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "alias", ResultFormat: "time_series"}, expected: "alias"},
		{name: "segmented name", rowName: "rowName.other.one", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "zero: $0 - one: $1 - second: $2", ResultFormat: "time_series"}, expected: "zero: rowName - one: other - second: one"},
		{name: "[[m]] measurement alias", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "[[m]]", ResultFormat: "time_series"}, expected: "rowName"},
		{name: "$m measurement alias", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "$m", ResultFormat: "time_series"}, expected: "rowName"},
		{name: "[[measurement]] measurement alias", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "[[measurement]]", ResultFormat: "time_series"}, expected: "rowName"},
		{name: "[[col]] column alias", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "[[col]]", ResultFormat: "time_series"}, expected: "colName"},
		{name: "$col column alias", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "$col", ResultFormat: "time_series"}, expected: "colName"},
		{name: "[[tag_key]] tag alias", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "[[tag_key]]", ResultFormat: "time_series"}, expected: "value"},
		{name: "$tag_key tag alias", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "$tag_key", ResultFormat: "time_series"}, expected: "value"},
		{name: "[[m]] with additional text", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "[[m]] - something", ResultFormat: "time_series"}, expected: "rowName - something"},
		{name: "$m with additional text", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "$m - something", ResultFormat: "time_series"}, expected: "rowName - something"},
		{name: "[[measurement]] with additional text", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "[[measurement]] - something", ResultFormat: "time_series"}, expected: "rowName - something"},
		{name: "[[col]] with additional text", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "[[col]] - something", ResultFormat: "time_series"}, expected: "colName - something"},
		{name: "$col with additional text", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "$col - something", ResultFormat: "time_series"}, expected: "colName - something"},
		{name: "[[tag_key]] with additional text", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "[[tag_key]] - something", ResultFormat: "time_series"}, expected: "value - something"},
		{name: "$tag_key with additional text", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value"}, query: models.Query{Alias: "$tag_key - something", ResultFormat: "time_series"}, expected: "value - something"},
		{name: "$tag_key complex", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value", "key2": "value2"}, query: models.Query{Alias: "L:$tag_key-$tag_key2", ResultFormat: "time_series"}, expected: "L:value-value2"},
		{name: "$__interval", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value", "key2": "value2"}, query: models.Query{Alias: "Interval: $__interval", Interval: time.Millisecond * 10}, expected: "Interval: 10ms"},
		{name: "$__interval_ms", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value", "key2": "value2"}, query: models.Query{Alias: "Interval: $__interval_ms", Interval: time.Millisecond * 10}, expected: "Interval: 10"},
		{name: "Complex alias with $__interval and $tag_key", rowName: "rowName", column: "colName", tags: map[string]string{"key": "value", "key2": "value2"}, query: models.Query{Alias: "Interval: $__interval_ms for tag: $tag_key", Interval: time.Millisecond * 10}, expected: "Interval: 10 for tag: value"},
	}

	frameName := make([]byte, 0, 128)
	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			result := string(FormatFrameName(tc.rowName, tc.column, tc.tags, tc.query, frameName[:]))
			require.Equal(t, tc.expected, result)
		})
	}
}
