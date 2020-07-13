package azuremonitor

import (
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/require"
)

func TestAzureLogAnalyticsMacros(t *testing.T) {
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
	timeRange := &tsdb.TimeRange{
		From: fmt.Sprintf("%v", fromStart.Unix()*1000),
		To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
	}

	tests := []struct {
		name      string
		query     *tsdb.Query
		timeRange *tsdb.TimeRange
		kql       string
		expected  string
		Err       require.ErrorAssertionFunc
	}{
		{
			name:     "invalid macro should be ignored",
			query:    &tsdb.Query{},
			kql:      "$__invalid()",
			expected: "$__invalid()",
			Err:      require.NoError,
		},
		{
			name:     "Kusto variables should be ignored",
			query:    &tsdb.Query{},
			kql:      ") on $left.b == $right.y",
			expected: ") on $left.b == $right.y",
			Err:      require.NoError,
		},
		{
			name:     "$__contains macro with a multi template variable that has multiple selected values as a parameter should build in clause",
			query:    &tsdb.Query{},
			kql:      "$__contains(col, 'val1','val2')",
			expected: "['col'] in ('val1','val2')",
			Err:      require.NoError,
		},
		{
			name:     "$__contains macro with a multi template variable that has a single selected value as a parameter should build in clause",
			query:    &tsdb.Query{},
			kql:      "$__contains(col, 'val1' )",
			expected: "['col'] in ('val1')",
			Err:      require.NoError,
		},
		{
			name:     "$__contains macro with multi template variable has custom All value as a parameter should return a true expression",
			query:    &tsdb.Query{},
			kql:      "$__contains(col, all)",
			expected: "1 == 1",
			Err:      require.NoError,
		},
		{
			name:     "$__timeFilter has no column parameter should use default time field",
			query:    &tsdb.Query{},
			kql:      "$__timeFilter()",
			expected: "['TimeGenerated'] >= datetime('2018-03-15T13:00:00Z') and ['TimeGenerated'] <= datetime('2018-03-15T13:34:00Z')",
			Err:      require.NoError,
		},
		{
			name:     "$__timeFilter has time field parameter",
			query:    &tsdb.Query{},
			kql:      "$__timeFilter(myTimeField)",
			expected: "['myTimeField'] >= datetime('2018-03-15T13:00:00Z') and ['myTimeField'] <= datetime('2018-03-15T13:34:00Z')",
			Err:      require.NoError,
		},
		{
			name:     "$__timeFrom and $__timeTo is in the query and range is a specific interval",
			query:    &tsdb.Query{},
			kql:      "myTimeField >= $__timeFrom() and myTimeField <= $__timeTo()",
			expected: "myTimeField >= datetime('2018-03-15T13:00:00Z') and myTimeField <= datetime('2018-03-15T13:34:00Z')",
			Err:      require.NoError,
		},
		{
			name:      "$__interval should use the defined interval from the query",
			timeRange: timeRange,
			query: &tsdb.Query{
				Model: simplejson.NewFromAny(map[string]interface{}{
					"interval": "5m",
				}),
			},
			kql:      "bin(TimeGenerated, $__interval)",
			expected: "bin(TimeGenerated, 300000ms)",
			Err:      require.NoError,
		},
		{
			name: "$__interval should use the default interval if none is specified",
			query: &tsdb.Query{
				DataSource: &models.DataSource{},
				Model:      simplejson.NewFromAny(map[string]interface{}{}),
			},
			kql:      "bin(TimeGenerated, $__interval)",
			expected: "bin(TimeGenerated, 34000ms)",
			Err:      require.NoError,
		},
		{
			name: "$__escapeMulti with multi template variable should replace values with KQL style escaped strings",
			query: &tsdb.Query{
				DataSource: &models.DataSource{},
				Model:      simplejson.NewFromAny(map[string]interface{}{}),
			},
			kql:      `CounterPath in ($__escapeMulti('\\grafana-vm\Network(eth0)\Total','\\grafana-vm\Network(eth1)\Total'))`,
			expected: `CounterPath in (@'\\grafana-vm\Network(eth0)\Total', @'\\grafana-vm\Network(eth1)\Total')`,
			Err:      require.NoError,
		},
		{
			name: "$__escapeMulti with multi template variable and has one selected value that contains comma",
			query: &tsdb.Query{
				DataSource: &models.DataSource{},
				Model:      simplejson.NewFromAny(map[string]interface{}{}),
			},
			kql:      `$__escapeMulti('\\grafana-vm,\Network(eth0)\Total Bytes Received')`,
			expected: `@'\\grafana-vm,\Network(eth0)\Total Bytes Received'`,
			Err:      require.NoError,
		},
		{
			name: "$__escapeMulti with multi template variable and is not wrapped in single quotes should fail",
			query: &tsdb.Query{
				DataSource: &models.DataSource{},
				Model:      simplejson.NewFromAny(map[string]interface{}{}),
			},
			kql:      `$__escapeMulti(\\grafana-vm,\Network(eth0)\Total Bytes Received)`,
			expected: "",
			Err:      require.Error,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defaultTimeField := "TimeGenerated"
			rawQuery, err := KqlInterpolate(tt.query, timeRange, tt.kql, defaultTimeField)
			tt.Err(t, err)
			if diff := cmp.Diff(tt.expected, rawQuery, cmpopts.EquateNaNs()); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
