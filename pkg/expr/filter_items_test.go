package expr

import (
	"context"
	"testing"

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
			name: "filter number items based on name",
			fiCmd: FilterItems{
				InputVar:   inputVar,
				MetricName: "A1",
				refID:      "B",
			},
			in: []mathexp.Value{
				mathexp.NewNumber("A1", nil).SetValue(ptr.Float64(1)),
				mathexp.NewNumber("B2", nil).SetValue(ptr.Float64(2)),
			},
			out: []mathexp.Value{
				mathexp.NewNumber("B", nil).SetValue(ptr.Float64(1)),
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
