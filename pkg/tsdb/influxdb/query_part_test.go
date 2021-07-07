package influxdb

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestInfluxdbQueryPart(t *testing.T) {
	tcs := []struct {
		mode     string
		input    string
		params   []string
		expected string
	}{
		{mode: "field", params: []string{"value"}, input: "value", expected: `"value"`},
		{mode: "derivative", params: []string{"10s"}, input: "mean(value)", expected: `derivative(mean(value), 10s)`},
		{mode: "bottom", params: []string{"3"}, input: "value", expected: `bottom(value, 3)`},
		{mode: "time", params: []string{"$interval"}, input: "", expected: `time($interval)`},
		{mode: "time", params: []string{"auto"}, input: "", expected: `time($__interval)`},
		{mode: "spread", params: []string{}, input: "value", expected: `spread(value)`},
		{mode: "math", params: []string{"/ 100"}, input: "mean(value)", expected: `mean(value) / 100`},
		{mode: "alias", params: []string{"test"}, input: "mean(value)", expected: `mean(value) AS "test"`},
		{mode: "count", params: []string{}, input: "distinct(value)", expected: `count(distinct(value))`},
		{mode: "mode", params: []string{}, input: "value", expected: `mode(value)`},
		{mode: "cumulative_sum", params: []string{}, input: "mean(value)", expected: `cumulative_sum(mean(value))`},
		{mode: "non_negative_difference", params: []string{}, input: "max(value)", expected: `non_negative_difference(max(value))`},
	}

	queryContext := &backend.QueryDataRequest{}
	query := &Query{}

	for _, tc := range tcs {
		part, err := NewQueryPart(tc.mode, tc.params)
		if err != nil {
			t.Errorf("Expected NewQueryPart to not return an error. error: %v", err)
		}

		res := part.Render(query, queryContext, tc.input)
		if res != tc.expected {
			t.Errorf("expected %v to render into %s", tc, tc.expected)
		}
	}
}
