package macros

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func TestAzureLogAnalyticsMacros(t *testing.T) {
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
	timeRange := backend.TimeRange{
		From: fromStart,
		To:   fromStart.Add(34 * time.Minute),
	}

	tests := []struct {
		name     string
		query    backend.DataQuery
		kql      string
		expected string
		Err      require.ErrorAssertionFunc
	}{
		{
			name:     "invalid macro should be ignored",
			query:    backend.DataQuery{},
			kql:      "$__invalid()",
			expected: "$__invalid()",
			Err:      require.NoError,
		},
		{
			name:     "Kusto variables should be ignored",
			query:    backend.DataQuery{},
			kql:      ") on $left.b == $right.y",
			expected: ") on $left.b == $right.y",
			Err:      require.NoError,
		},
		{
			name:     "$__contains macro with a multi template variable that has multiple selected values as a parameter should build in clause",
			query:    backend.DataQuery{},
			kql:      "$__contains(col, 'val1','val2')",
			expected: "['col'] in ('val1','val2')",
			Err:      require.NoError,
		},
		{
			name:     "$__contains macro with a multi template variable that has a single selected value as a parameter should build in clause",
			query:    backend.DataQuery{},
			kql:      "$__contains(col, 'val1' )",
			expected: "['col'] in ('val1')",
			Err:      require.NoError,
		},
		{
			name:     "$__contains macro with multi template variable has custom All value as a parameter should return a true expression",
			query:    backend.DataQuery{},
			kql:      "$__contains(col, all)",
			expected: "1 == 1",
			Err:      require.NoError,
		},
		{
			name:     "$__timeFilter has no column parameter should use default time field",
			query:    backend.DataQuery{TimeRange: timeRange},
			kql:      "$__timeFilter()",
			expected: "['TimeGenerated'] >= datetime('2018-03-15T13:00:00Z') and ['TimeGenerated'] <= datetime('2018-03-15T13:34:00Z')",
			Err:      require.NoError,
		},
		{
			name:     "$__timeFilter has time field parameter",
			query:    backend.DataQuery{TimeRange: timeRange},
			kql:      "$__timeFilter(myTimeField)",
			expected: "['myTimeField'] >= datetime('2018-03-15T13:00:00Z') and ['myTimeField'] <= datetime('2018-03-15T13:34:00Z')",
			Err:      require.NoError,
		},
		{
			name:     "$__timeFrom and $__timeTo is in the query and range is a specific interval",
			query:    backend.DataQuery{TimeRange: timeRange},
			kql:      "myTimeField >= $__timeFrom() and myTimeField <= $__timeTo()",
			expected: "myTimeField >= datetime('2018-03-15T13:00:00Z') and myTimeField <= datetime('2018-03-15T13:34:00Z')",
			Err:      require.NoError,
		},
		{
			name: "$__interval should use the defined interval from the query",
			query: backend.DataQuery{
				JSON: []byte(`{
					"interval": "5m"
				}`),
				TimeRange: timeRange,
			},
			kql:      "bin(TimeGenerated, $__interval)",
			expected: "bin(TimeGenerated, 300000ms)",
			Err:      require.NoError,
		},
		{
			name:     "$__interval should use the default interval if none is specified",
			query:    backend.DataQuery{TimeRange: timeRange},
			kql:      "bin(TimeGenerated, $__interval)",
			expected: "bin(TimeGenerated, 34000ms)",
			Err:      require.NoError,
		},
		{
			name:     "$__escapeMulti with multi template variable should replace values with KQL style escaped strings",
			query:    backend.DataQuery{},
			kql:      `CounterPath in ($__escapeMulti('\\grafana-vm\Network(eth0)\Total','\\grafana-vm\Network(eth1)\Total'))`,
			expected: `CounterPath in (@'\\grafana-vm\Network(eth0)\Total', @'\\grafana-vm\Network(eth1)\Total')`,
			Err:      require.NoError,
		},
		{
			name:     "$__escapeMulti with multi template variable and has one selected value that contains comma",
			query:    backend.DataQuery{},
			kql:      `$__escapeMulti('\\grafana-vm,\Network(eth0)\Total Bytes Received')`,
			expected: `@'\\grafana-vm,\Network(eth0)\Total Bytes Received'`,
			Err:      require.NoError,
		},
		{
			name:     "$__escapeMulti with multi template variable and is not wrapped in single quotes should fail",
			query:    backend.DataQuery{},
			kql:      `$__escapeMulti(\\grafana-vm,\Network(eth0)\Total Bytes Received)`,
			expected: "",
			Err:      require.Error,
		},
		{
			name: "traces time field should remain as timestamp",
			query: backend.DataQuery{
				QueryType: "Azure Traces",
				TimeRange: timeRange,
			},
			kql:      `$__timeFilter()`,
			expected: "['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')",
			Err:      require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defaultTimeField := "TimeGenerated"
			rawQuery, err := KqlInterpolate(log.New("test"), tt.query, types.DatasourceInfo{}, tt.kql, defaultTimeField)
			tt.Err(t, err)
			if diff := cmp.Diff(tt.expected, rawQuery, cmpopts.EquateNaNs()); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
