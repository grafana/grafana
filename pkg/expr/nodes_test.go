package expr

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type expectedError struct{}

func (e expectedError) Error() string {
	return "expected"
}

func TestQueryError_Error(t *testing.T) {
	e := MakeQueryError("A", "", errors.New("this is an error message"))
	assert.EqualError(t, e, "[sse.dataQueryError] failed to execute query [A]: this is an error message")
}

func TestQueryError_Unwrap(t *testing.T) {
	t.Run("errors.Is", func(t *testing.T) {
		expectedIsErr := errors.New("expected")
		e := MakeQueryError("A", "", expectedIsErr)
		assert.True(t, errors.Is(e, expectedIsErr))
	})

	t.Run("errors.As", func(t *testing.T) {
		e := MakeQueryError("A", "", expectedError{})
		var expectedAsError expectedError
		assert.True(t, errors.As(e, &expectedAsError))
	})
}

func TestCheckIfSeriesNeedToBeFixed(t *testing.T) {
	createFrame := func(m ...func(field *data.Field)) []*data.Frame {
		f := data.NewFrame("",
			data.NewField("Time", nil, []time.Time{}))
		for i := 0; i < 100; i++ {
			fld := data.NewField(fmt.Sprintf("fld-%d", i), nil, []*float64{})
			fld.Config = &data.FieldConfig{}
			for _, change := range m {
				change(fld)
			}
			f.Fields = append(f.Fields, fld)
		}
		return []*data.Frame{f}
	}
	withLabels := func(field *data.Field) {
		field.Labels = map[string]string{
			"field": field.Name,
		}
	}
	withDisplayNameFromDS := func(field *data.Field) {
		field.Config.DisplayNameFromDS = fmt.Sprintf("dnds-%s", field.Name)
	}
	withDisplayName := func(field *data.Field) {
		field.Config.DisplayName = fmt.Sprintf("dn-%s", field.Name)
	}
	withoutName := func(field *data.Field) {
		field.Name = ""
	}

	getLabelName := func(f func(series mathexp.Series, valueField *data.Field)) string {
		s := mathexp.NewSeries("A", nil, 0)
		field := &data.Field{
			Name: "Name",
			Config: &data.FieldConfig{
				DisplayNameFromDS: "DisplayNameFromDS",
				DisplayName:       "DisplayName",
			},
		}
		f(s, field)
		return s.GetLabels()[nameLabelName]
	}

	testCases := []struct {
		name         string
		frames       []*data.Frame
		expectedName string
	}{
		{
			name:         "should return nil if at least one value field has labels",
			frames:       createFrame(withLabels, withDisplayNameFromDS, withDisplayName),
			expectedName: "",
		},
		{
			name:         "should return nil if names are empty",
			frames:       createFrame(withoutName),
			expectedName: "",
		},
		{
			name:         "should return patcher with DisplayNameFromDS first",
			frames:       createFrame(withDisplayNameFromDS, withDisplayName),
			expectedName: "DisplayNameFromDS",
		},
		{
			name: "should return patcher with DisplayName if DisplayNameFromDS is not unique",
			frames: func() []*data.Frame {
				frames := createFrame(withDisplayNameFromDS, withDisplayName)
				f := frames[0]
				f.Fields[2].Config.DisplayNameFromDS = "test"
				f.Fields[3].Config.DisplayNameFromDS = "test"
				return frames
			}(),
			expectedName: "DisplayName",
		},
		{
			name:         "should return patcher with DisplayName if is empty",
			frames:       createFrame(withDisplayName),
			expectedName: "DisplayName",
		},
		{
			name: "should return patcher with Name if DisplayName and DisplayNameFromDS are not unique",
			frames: func() []*data.Frame {
				frames := createFrame(withDisplayNameFromDS, withDisplayName)
				f := frames[0]
				f.Fields[1].Config.DisplayNameFromDS = f.Fields[2].Config.DisplayNameFromDS
				f.Fields[1].Config.DisplayName = f.Fields[2].Config.DisplayName
				return frames
			}(),
			expectedName: "Name",
		},
		{
			name:         "should return patcher with Name if DisplayName and DisplayNameFromDS are empty",
			frames:       createFrame(),
			expectedName: "Name",
		},
		{
			name: "should return nil if all fields are not unique",
			frames: func() []*data.Frame {
				frames := createFrame(withDisplayNameFromDS, withDisplayName)
				f := frames[0]
				f.Fields[1].Config.DisplayNameFromDS = f.Fields[2].Config.DisplayNameFromDS
				f.Fields[1].Config.DisplayName = f.Fields[2].Config.DisplayName
				f.Fields[1].Name = f.Fields[2].Name
				return frames
			}(),
			expectedName: "",
		},
	}

	supportedDatasources := []string{
		datasources.DS_GRAPHITE,
		datasources.DS_TESTDATA,
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			for _, datasource := range supportedDatasources {
				fixer := checkIfSeriesNeedToBeFixed(tc.frames, datasource)
				if tc.expectedName == "" {
					require.Nil(t, fixer)
				} else {
					require.Equal(t, tc.expectedName, getLabelName(fixer))
				}
			}
		})
	}
}

func TestConvertDataFramesToResults(t *testing.T) {
	s := &Service{
		cfg:      setting.NewCfg(),
		features: &featuremgmt.FeatureManager{},
		tracer:   tracing.InitializeTracerForTest(),
		metrics:  newMetrics(nil),
	}

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
						resultType, res, err := convertDataFramesToResults(context.Background(), frames, dtype, s, &logtest.Fake{})
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
						resultType, res, err := convertDataFramesToResults(context.Background(), frames, dtype, s, &logtest.Fake{})
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
					resultType, res, err := convertDataFramesToResults(context.Background(), frames, dtype, s, &logtest.Fake{})
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

func TestWideToMany(t *testing.T) {
	f := data.NewFrame("Test",
		data.NewField("Time", nil, []time.Time{}))
	for i := 0; i < 10; i++ {
		lbls := make(data.Labels, 5)
		for j := 0; j < 5; j++ {
			lbls[fmt.Sprintf("lbl%d", j)] = fmt.Sprintf("value%d", i)
		}
		f.Fields = append(f.Fields, data.NewField(fmt.Sprintf("val-%d", i), lbls, []*float64{}))
	}
	for i := 0; i < 100; i++ {
		row := make([]interface{}, 0, len(f.Fields))
		row = append(row, time.Now().Add(-time.Duration(i)))
		for j := 1; j < cap(row); j++ {
			v := rand.Float64()
			row = append(row, &v)
		}
		f.AppendRow(row...)
	}

	ser, err := WideToMany(f, nil)
	if err != nil {
		require.NoError(t, err)
	}
	require.Len(t, ser, 10)

	timeField := f.Fields[0]
	for idx, series := range ser {
		field := f.Fields[idx+1]
		require.Equal(t, field.Len(), series.Len())
		require.EqualValues(t, field.Labels, series.GetLabels())
		for i := 0; i < field.Len(); i++ {
			actualTime, actualValue := series.GetPoint(i)
			require.EqualValues(t, timeField.At(i), actualTime)
			require.EqualValues(t, field.At(i), actualValue)
		}
	}
}
