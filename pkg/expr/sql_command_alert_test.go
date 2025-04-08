package expr

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestExtractNumberSetFromSQLForAlerting(t *testing.T) {
	t.Run("SingleRowNoLabels", func(t *testing.T) {
		input := data.NewFrame("",
			data.NewField(SQLValueFieldName, nil, []*float64{fp(3.14)}),
		)

		numbers, err := extractNumberSetFromSQLForAlerting(input)
		require.NoError(t, err)
		require.Len(t, numbers, 1)

		got := numbers[0]
		require.Equal(t, fp(3.14), got.GetFloat64Value())
		require.Equal(t, data.Labels{}, got.GetLabels())
	})

	t.Run("TwoRowsWithLabelsAndDisplay", func(t *testing.T) {
		input := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(2.0)}),
			data.NewField(SQLDisplayFieldName, nil, []*string{sp("CPU A"), sp("CPU B")}),
			data.NewField("host", nil, []*string{sp("a"), sp("b")}),
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
			SQLDisplayFieldName: "CPU B",
			"host":              "b",
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

func TestExtractNumberSetFromSQLForAlerting_Duplicates(t *testing.T) {
	t.Run("AllDuplicates_ReturnsError", func(t *testing.T) {
		input := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(2.0)}),
			data.NewField("host", nil, []*string{sp("a"), sp("a")}),
		)

		numbers, err := extractNumberSetFromSQLForAlerting(input)
		require.Error(t, err)
		require.Nil(t, numbers)
		require.Contains(t, err.Error(), "duplicate values across the string columns")
		require.Contains(t, err.Error(), "host=a")
		require.Contains(t, err.Error(), "GROUP BY or aggregation")
	})

	t.Run("SomeDuplicates_ReturnsError", func(t *testing.T) {
		input := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu", "cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(2.0), fp(3.0)}),
			data.NewField("host", nil, []*string{sp("a"), sp("a"), sp("b")}),
		)

		numbers, err := extractNumberSetFromSQLForAlerting(input)
		require.Error(t, err)
		require.Nil(t, numbers)
		require.Contains(t, err.Error(), "duplicate values across the string columns")
		require.Contains(t, err.Error(), "host=a")
		require.Contains(t, err.Error(), "GROUP BY or aggregation")
	})

	t.Run("NoDuplicates_Succeeds", func(t *testing.T) {
		input := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(2.0)}),
			data.NewField("host", nil, []*string{sp("a"), sp("b")}),
		)

		numbers, err := extractNumberSetFromSQLForAlerting(input)
		require.NoError(t, err)
		require.Len(t, numbers, 2)

		require.Equal(t, data.Labels{
			SQLMetricFieldName: "cpu",
			"host":             "a",
		}, numbers[0].GetLabels())
		require.Equal(t, data.Labels{
			SQLMetricFieldName: "cpu",
			"host":             "b",
		}, numbers[1].GetLabels())
	})

	t.Run("MoreThan10DuplicateSets_TruncatesErrorList", func(t *testing.T) {
		const totalRows = 30
		labels := make([]string, totalRows)
		values := make([]*float64, totalRows)
		hosts := make([]*string, totalRows)

		for i := 0; i < totalRows; i++ {
			labels[i] = "cpu"
			values[i] = fp(float64(i + 1))
			h := fmt.Sprintf("host%d", i%15) // 15 distinct combos, each duplicated
			hosts[i] = &h
		}

		input := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, labels),
			data.NewField(SQLValueFieldName, nil, values),
			data.NewField("host", nil, hosts),
		)

		numbers, err := extractNumberSetFromSQLForAlerting(input)
		require.Error(t, err)
		require.Nil(t, numbers)

		require.Contains(t, err.Error(), "duplicate values across the string columns")
		require.Contains(t, err.Error(), "Examples:")
		require.Contains(t, err.Error(), "... and 10 more")
		require.Contains(t, err.Error(), "GROUP BY or aggregation")
	})
}
