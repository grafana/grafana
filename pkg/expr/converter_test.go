package expr

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestConvertDataFramesToResults(t *testing.T) {
	s := &Service{
		cfg:      setting.NewCfg(),
		features: featuremgmt.WithFeatures(),
		tracer:   tracing.InitializeTracerForTest(),
		metrics:  newMetrics(nil),
	}
	converter := &ResultConverter{Features: s.features, Tracer: s.tracer}

	t.Run("should add name label if no labels and specific data source", func(t *testing.T) {
		supported := []string{datasources.DS_GRAPHITE, datasources.DS_TESTDATA}
		t.Run("when only field name is specified", func(t *testing.T) {
			t.Run("use value field names if one frame - many series (ie. Wide format)", func(t *testing.T) {
				supported := []string{datasources.DS_GRAPHITE, datasources.DS_TESTDATA}

				frames := []*data.Frame{
					data.NewFrame("test",
						data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
						data.NewField("test-value1", nil, []*float64{fp(2)}),
						data.NewField("test-value2", nil, []*float64{fp(2)})),
				}

				for _, dtype := range supported {
					t.Run(dtype, func(t *testing.T) {
						resultType, res, err := converter.Convert(context.Background(), dtype, frames)
						require.NoError(t, err)
						// What actually is a "single frame series"?
						assert.Equal(t, "single frame series", resultType)
						require.Len(t, res.Values, 2)

						var names []string
						for _, value := range res.Values {
							require.IsType(t, mathexp.Series{}, value)
							lbls := value.GetLabels()
							require.Contains(t, lbls, nameLabelName)
							names = append(names, lbls[nameLabelName])
						}
						require.EqualValues(t, []string{"test-value1", "test-value2"}, names)
					})
				}
			})
			t.Run("should use frame name if one frame - one series", func(t *testing.T) {
				frames := []*data.Frame{
					data.NewFrame("test-frame1",
						data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
						data.NewField("test-value1", nil, []*float64{fp(2)})),
					data.NewFrame("test-frame2",
						data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
						data.NewField("test-value2", nil, []*float64{fp(2)})),
				}

				for _, dtype := range supported {
					t.Run(dtype, func(t *testing.T) {
						resultType, res, err := converter.Convert(context.Background(), dtype, frames)
						require.NoError(t, err)
						assert.Equal(t, "multi frame series", resultType)
						require.Len(t, res.Values, 2)

						var names []string
						for _, value := range res.Values {
							require.IsType(t, mathexp.Series{}, value)
							lbls := value.GetLabels()
							require.Contains(t, lbls, nameLabelName)
							names = append(names, lbls[nameLabelName])
						}
						require.EqualValues(t, []string{"test-frame1", "test-frame2"}, names)
					})
				}
			})
		})
		t.Run("should use fields DisplayNameFromDS when it is unique", func(t *testing.T) {
			f1 := data.NewField("test-value1", nil, []*float64{fp(2)})
			f1.Config = &data.FieldConfig{DisplayNameFromDS: "test-value1"}
			f2 := data.NewField("test-value2", nil, []*float64{fp(2)})
			f2.Config = &data.FieldConfig{DisplayNameFromDS: "test-value2"}
			frames := []*data.Frame{
				data.NewFrame("test-frame1",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					f1),
				data.NewFrame("test-frame2",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					f2),
			}

			for _, dtype := range supported {
				t.Run(dtype, func(t *testing.T) {
					resultType, res, err := converter.Convert(context.Background(), dtype, frames)
					require.NoError(t, err)
					assert.Equal(t, "multi frame series", resultType)
					require.Len(t, res.Values, 2)

					var names []string
					for _, value := range res.Values {
						require.IsType(t, mathexp.Series{}, value)
						lbls := value.GetLabels()
						require.Contains(t, lbls, nameLabelName)
						names = append(names, lbls[nameLabelName])
					}
					require.EqualValues(t, []string{"test-value1", "test-value2"}, names)
				})
			}
		})
	})
}

func TestNumericFullLongToNumberSetWithSparseLabels(t *testing.T) {
	// Create a frame with a numeric column and string columns, one of which has sparse values
	frame := data.NewFrame("test",
		data.NewField("value", nil, []float64{13, 17}),
		data.NewField("host", nil, []*string{stringPtr("dummy_a"), stringPtr("dummy_b")}),
		data.NewField("sparse_label", nil, []*string{
			stringPtr("label_value_present"),
			nil, // This label is not present for the second row
		}),
	)

	// Run the NumericFullLongToNumberSet function
	numbers, err := NumericFullLongToNumberSet(frame)
	require.NoError(t, err)
	require.Len(t, numbers, 2)

	// Check the first row - should have both labels
	require.Equal(t, float64(13), *numbers[0].GetFloat64Value())
	labels1 := numbers[0].GetLabels()
	require.Equal(t, "dummy_a", labels1["host"])
	require.Equal(t, "label_value_present", labels1["sparse_label"])

	// Check the second row - should only have the 'host' label
	require.Equal(t, float64(17), *numbers[1].GetFloat64Value())
	labels2 := numbers[1].GetLabels()
	require.Equal(t, "dummy_b", labels2["host"])

	// Verify sparse_label is not present in second row's labels
	_, hasLabel := labels2["sparse_label"]
	require.False(t, hasLabel, "sparse_label should not be present in second row's labels")
}
