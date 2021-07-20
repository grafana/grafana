package expr

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"
)

func TestFilterItems(t *testing.T) {
	inputVar := "A"
	var tests = []struct {
		name  string
		fiCmd FilterItems
		in    mathexp.Values
		out   mathexp.Values
	}{
		{
			name: "filter number items based on exact name",
			fiCmd: FilterItems{
				InputVar:   inputVar,
				MetricName: "idle",
				refID:      "iNamedItIdle",
			},
			in: []mathexp.Value{
				mathexp.NewNumber("idle", nil).SetValue(ptr.Float64(1)),
				mathexp.NewNumber("sys", nil).SetValue(ptr.Float64(2)),
			},
			out: []mathexp.Value{
				mathexp.NewNumber("iNamedItIdle", nil).SetValue(ptr.Float64(1)),
			},
		},
		{
			name: "filter number items based on regex name",
			fiCmd: FilterItems{
				InputVar:   inputVar,
				IsRegex:    true,
				MetricName: "dl",
				refID:      "iNamedItIdle",
			},
			in: []mathexp.Value{
				mathexp.NewNumber("idle", nil).SetValue(ptr.Float64(1)),
				mathexp.NewNumber("sys", nil).SetValue(ptr.Float64(2)),
			},
			out: []mathexp.Value{
				mathexp.NewNumber("iNamedItIdle", nil).SetValue(ptr.Float64(1)),
			},
		},
		{
			name: "filter number items based on label matches only",
			fiCmd: FilterItems{
				InputVar:      inputVar,
				refID:         "iNamedItHostA",
				LabelMatchers: `metric="idle"`,
			},
			in: []mathexp.Value{
				mathexp.NewNumber("", data.Labels{"host": "a", "metric": "idle"}).SetValue(ptr.Float64(1)),
				mathexp.NewNumber("", data.Labels{"host": "a", "metric": "sys"}).SetValue(ptr.Float64(2)),
				mathexp.NewNumber("", data.Labels{"host": "b", "metric": "idle"}).SetValue(ptr.Float64(3)),
				mathexp.NewNumber("", data.Labels{"host": "b", "metric": "sys"}).SetValue(ptr.Float64(4)),
			},
			out: []mathexp.Value{
				mathexp.NewNumber("iNamedItHostA", data.Labels{"host": "a", "metric": "idle"}).SetValue(ptr.Float64(1)),
				mathexp.NewNumber("iNamedItHostA", data.Labels{"host": "b", "metric": "idle"}).SetValue(ptr.Float64(3)),
			},
		},
		{
			name: "filter number items based on label matchers and name",
			fiCmd: FilterItems{
				InputVar:      inputVar,
				refID:         "iNamedIt🦉",
				LabelMatchers: `metric="idle"`,
				MetricName:    "🦥",
			},
			in: []mathexp.Value{
				mathexp.NewNumber("🦥", data.Labels{"host": "a", "metric": "idle"}).SetValue(ptr.Float64(1)),
				mathexp.NewNumber("🦥", data.Labels{"host": "a", "metric": "sys"}).SetValue(ptr.Float64(2)),
				mathexp.NewNumber("", data.Labels{"host": "b", "metric": "idle"}).SetValue(ptr.Float64(3)),
				mathexp.NewNumber("", data.Labels{"host": "b", "metric": "sys"}).SetValue(ptr.Float64(4)),
			},
			out: []mathexp.Value{
				mathexp.NewNumber("iNamedIt🦉", data.Labels{"host": "a", "metric": "idle"}).SetValue(ptr.Float64(1)),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.fiCmd.buildFilters()
			require.NoError(t, err)

			filtered, err := tt.fiCmd.Execute(context.Background(), mathexp.Vars{
				inputVar: mathexp.Results{Values: tt.in},
			})
			require.NoError(t, err)

			require.Equal(t, tt.out, filtered.Values)
		})
	}
}
