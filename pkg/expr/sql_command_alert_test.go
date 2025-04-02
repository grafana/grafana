package expr

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestExtractNumberSetFromSQLForAlerting(t *testing.T) {
	t.Run("SingleRowNoLabels", func(t *testing.T) {
		input := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu"}), // will be treated as a label
			data.NewField(SQLValueFieldName, nil, []*float64{fp(3.14)}),
		)

		numbers, err := extractNumberSetFromSQLForAlerting(input)
		require.NoError(t, err)
		require.Len(t, numbers, 1)

		got := numbers[0]
		require.Equal(t, fp(3.14), got.GetFloat64Value())
		require.Equal(t, data.Labels{
			SQLMetricFieldName: "cpu",
		}, got.GetLabels())
	})

	t.Run("TwoRowsWithLabelsAndDisplay", func(t *testing.T) {
		input := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(2.0)}),
			data.NewField(SQLDisplayFieldName, nil, []*string{sp("CPU A"), sp("CPU A")}),
			data.NewField("host", nil, []*string{sp("a"), sp("a")}),
		)

		numbers, err := extractNumberSetFromSQLForAlerting(input)
		require.NoError(t, err)
		require.Len(t, numbers, 2)

		require.Equal(t, fp(1.0), numbers[0].GetFloat64Value())
		require.Equal(t, data.Labels{
			SQLMetricFieldName:  "cpu",
			SQLDisplayFieldName: "CPU A",
			"host":              "a",
		}, numbers[0].GetLabels())

		require.Equal(t, fp(2.0), numbers[1].GetFloat64Value())
		require.Equal(t, data.Labels{
			SQLMetricFieldName:  "cpu",
			SQLDisplayFieldName: "CPU A",
			"host":              "a",
		}, numbers[1].GetLabels())
	})

	t.Run("TwoFieldsWithSparseLabels", func(t *testing.T) {
		input := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(2.0)}),
			data.NewField("env", nil, []*string{nil, sp("prod")}),
			data.NewField("host", nil, []*string{sp("a"), sp("b")}),
		)

		numbers, err := extractNumberSetFromSQLForAlerting(input)
		require.NoError(t, err)
		require.Len(t, numbers, 2)

		require.Equal(t, fp(1.0), numbers[0].GetFloat64Value())
		require.Equal(t, data.Labels{
			SQLMetricFieldName: "cpu",
			"host":             "a",
		}, numbers[0].GetLabels())

		require.Equal(t, fp(2.0), numbers[1].GetFloat64Value())
		require.Equal(t, data.Labels{
			SQLMetricFieldName: "cpu",
			"host":             "b",
			"env":              "prod",
		}, numbers[1].GetLabels())
	})
}
