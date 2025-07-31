package expr

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestConvertDataFramesToResults(t *testing.T) {
	settingsProvider := setting.ProvideService(setting.NewCfg())
	s := &Service{
		settingsProvider: settingsProvider,
		features:         featuremgmt.WithFeatures(),
		tracer:           tracing.InitializeTracerForTest(),
		metrics:          metrics.NewSSEMetrics(nil),
	}
	converter := &ResultConverter{Features: s.features, Tracer: s.tracer}

	t.Run("should add name label if no labels and specific data source", func(t *testing.T) {
		supported := []string{datasources.DS_GRAPHITE, datasources.DS_TESTDATA}
		t.Run("when only field name is specified", func(t *testing.T) {
			t.Run("use value field names if one frame - many series", func(t *testing.T) {
				supported := []string{datasources.DS_GRAPHITE, datasources.DS_TESTDATA}

				frames := []*data.Frame{
					data.NewFrame("test",
						data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
						data.NewField("test-value1", nil, []*float64{fp(2)}),
						data.NewField("test-value2", nil, []*float64{fp(2)})),
				}

				for _, dtype := range supported {
					t.Run(dtype, func(t *testing.T) {
						resultType, res, err := converter.Convert(context.Background(), dtype, frames, false)
						require.NoError(t, err)
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
						resultType, res, err := converter.Convert(context.Background(), dtype, frames, false)
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
					resultType, res, err := converter.Convert(context.Background(), dtype, frames, false)
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

func TestHandleSqlInput(t *testing.T) {
	tests := []struct {
		name        string
		frames      data.Frames
		expectErr   string
		expectFrame bool
	}{
		{
			name:        "single frame with no fields and no type is passed through",
			frames:      data.Frames{data.NewFrame("")},
			expectFrame: true,
		},
		{
			name:        "single frame with no fields but type timeseries-multi is passed through",
			frames:      data.Frames{data.NewFrame("").SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti})},
			expectFrame: true,
		},
		{
			name: "single frame, no labels, no type → passes through",
			frames: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					data.NewField("value", nil, []*float64{fp(2)}),
				),
			},
			expectFrame: true,
		},
		{
			name: "single frame with labels, but missing FrameMeta.Type → error",
			frames: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					data.NewField("value", data.Labels{"foo": "bar"}, []*float64{fp(2)}),
				),
			},
			expectErr: "frame has labels but frame type is missing or unsupported",
		},
		{
			name: "multiple frames, no type → error",
			frames: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					data.NewField("value", nil, []*float64{fp(2)}),
				),
				data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					data.NewField("value", nil, []*float64{fp(2)}),
				),
			},
			expectErr: "response has more than one frame but frame type is missing or unsupported",
		},
		{
			name: "supported type (timeseries-multi) triggers ConvertToFullLong",
			frames: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					data.NewField("value", data.Labels{"host": "a"}, []*float64{fp(2)}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
			},
			expectFrame: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			res := handleSqlInput(tc.frames)

			if tc.expectErr != "" {
				require.Error(t, res.Error)
				require.ErrorContains(t, res.Error, tc.expectErr)
			} else {
				require.NoError(t, res.Error)
				if tc.expectFrame {
					require.Len(t, res.Values, 1)
					require.IsType(t, mathexp.TableData{}, res.Values[0])
					assert.NotNil(t, res.Values[0].(mathexp.TableData).Frame)
				}
			}
		})
	}
}
