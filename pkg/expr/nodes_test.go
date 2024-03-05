package expr

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/services/datasources"
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
