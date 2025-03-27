package expr

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type ResultConverter struct {
	Features featuremgmt.FeatureToggles
	Tracer   tracing.Tracer
}

func (c *ResultConverter) Convert(ctx context.Context,
	datasourceType string,
	frames data.Frames,
) (string, mathexp.Results, error) {
	if len(frames) == 0 {
		return "no-data", mathexp.Results{Values: mathexp.Values{mathexp.NewNoData()}}, nil
	}

	var dt data.FrameType
	dt, useDataplane, _ := shouldUseDataplane(frames, logger, c.Features.IsEnabled(ctx, featuremgmt.FlagDisableSSEDataplane))
	if useDataplane {
		logger.Debug("Handling SSE data source query through dataplane", "datatype", dt)
		result, err := handleDataplaneFrames(ctx, c.Tracer, c.Features, dt, frames)
		return fmt.Sprintf("dataplane-%s", dt), result, err
	}

	if isAllFrameVectors(datasourceType, frames) { // Prometheus Specific Handling
		vals, err := framesToNumbers(frames)
		if err != nil {
			return "", mathexp.Results{}, fmt.Errorf("failed to read frames as numbers: %w", err)
		}
		return "vector", mathexp.Results{Values: vals}, nil
	}

	if len(frames) == 1 {
		frame := frames[0]
		// Handle Untyped NoData
		if len(frame.Fields) == 0 {
			return "no-data", mathexp.Results{Values: mathexp.Values{mathexp.NoData{Frame: frame}}}, nil
		}

		// Handle Numeric Table
		if frame.TimeSeriesSchema().Type == data.TimeSeriesTypeNot && isNumberTable(frame) {
			numberSet, err := extractNumberSet(frame)
			if err != nil {
				return "", mathexp.Results{}, err
			}
			vals := make([]mathexp.Value, 0, len(numberSet))
			for _, n := range numberSet {
				vals = append(vals, n)
			}
			return "number set", mathexp.Results{
				Values: vals,
			}, nil
		}
	}

	filtered := make([]*data.Frame, 0, len(frames))
	totalLen := 0
	for _, frame := range frames {
		schema := frame.TimeSeriesSchema()
		// Check for TimeSeriesTypeNot in InfluxDB queries. A data frame of this type will cause
		// the WideToMany() function to error out, which results in unhealthy alerts.
		// This check should be removed once inconsistencies in data source responses are solved.
		if schema.Type == data.TimeSeriesTypeNot && datasourceType == datasources.DS_INFLUXDB {
			logger.Warn("Ignoring InfluxDB data frame due to missing numeric fields")
			continue
		}

		if schema.Type != data.TimeSeriesTypeWide {
			return "", mathexp.Results{}, fmt.Errorf("%w but got type %s (input refid)", ErrSeriesMustBeWide, schema.Type)
		}
		filtered = append(filtered, frame)
		totalLen += len(schema.ValueIndices)
	}

	if len(filtered) == 0 {
		return "no data", mathexp.Results{Values: mathexp.Values{mathexp.NoData{Frame: frames[0]}}}, nil
	}

	maybeFixerFn := checkIfSeriesNeedToBeFixed(filtered, datasourceType)

	dataType := "single frame series"
	if len(filtered) > 1 {
		dataType = "multi frame series"
	}

	vals := make([]mathexp.Value, 0, totalLen)
	for _, frame := range filtered {
		schema := frame.TimeSeriesSchema()
		if schema.Type == data.TimeSeriesTypeWide {
			series, err := WideToMany(frame, maybeFixerFn)
			if err != nil {
				return "", mathexp.Results{}, err
			}
			for _, ser := range series {
				vals = append(vals, ser)
			}
		} else {
			v := mathexp.TableData{Frame: frame}
			vals = append(vals, v)
			dataType = "single frame"
		}
	}

	return dataType, mathexp.Results{
		Values: vals,
	}, nil
}

func getResponseFrame(logger *log.ConcreteLogger, resp *backend.QueryDataResponse, refID string) (data.Frames, error) {
	response, ok := resp.Responses[refID]
	if !ok {
		// This indicates that the RefID of the request was not included to the response, i.e. some problem in the data source plugin
		keys := make([]string, 0, len(resp.Responses))
		for refID := range resp.Responses {
			keys = append(keys, refID)
		}
		logger.Warn("Can't find response by refID. Return nodata", "responseRefIds", keys)
		return nil, nil
	}

	if response.Error != nil {
		return nil, response.Error
	}
	return response.Frames, nil
}

func isAllFrameVectors(datasourceType string, frames data.Frames) bool {
	if datasourceType != datasources.DS_PROMETHEUS {
		return false
	}
	allVector := false
	for i, frame := range frames {
		if frame.Meta != nil && frame.Meta.Custom != nil {
			if sMap, ok := frame.Meta.Custom.(map[string]string); ok {
				if sMap != nil {
					if sMap["resultType"] == "vector" {
						if i != 0 && !allVector {
							break
						}
						allVector = true
					}
				}
			}
		}
	}
	return allVector
}

func framesToNumbers(frames data.Frames) ([]mathexp.Value, error) {
	vals := make([]mathexp.Value, 0, len(frames))
	for _, frame := range frames {
		if frame == nil {
			continue
		}
		if len(frame.Fields) == 2 && frame.Fields[0].Len() == 1 {
			// Can there be zero Len Field results that are being skipped?
			valueField := frame.Fields[1]
			if valueField.Type().Numeric() { // should be []float64
				val, err := valueField.FloatAt(0) // FloatAt should not err if numeric
				if err != nil {
					return nil, fmt.Errorf("failed to read value of frame [%v] (RefID %v) of type [%v] as float: %w", frame.Name, frame.RefID, valueField.Type(), err)
				}
				n := mathexp.NewNumber(frame.Name, valueField.Labels)
				n.SetValue(&val)
				vals = append(vals, n)
			}
		}
	}
	return vals, nil
}

func isNumberTable(frame *data.Frame) bool {
	if frame == nil || frame.Fields == nil {
		return false
	}
	numericCount := 0
	stringCount := 0
	otherCount := 0
	for _, field := range frame.Fields {
		fType := field.Type()
		switch {
		case fType.Numeric():
			numericCount++
		case fType == data.FieldTypeString || fType == data.FieldTypeNullableString:
			stringCount++
		default:
			otherCount++
		}
	}
	return numericCount == 1 && otherCount == 0
}

func extractNumberSet(frame *data.Frame) ([]mathexp.Number, error) {
	numericField := 0
	stringFieldIdxs := []int{}
	stringFieldNames := []string{}
	for i, field := range frame.Fields {
		fType := field.Type()
		switch {
		case fType.Numeric():
			numericField = i
		case fType == data.FieldTypeString || fType == data.FieldTypeNullableString:
			stringFieldIdxs = append(stringFieldIdxs, i)
			stringFieldNames = append(stringFieldNames, field.Name)
		}
	}
	numbers := make([]mathexp.Number, frame.Rows())

	for rowIdx := 0; rowIdx < frame.Rows(); rowIdx++ {
		val, _ := frame.FloatAt(numericField, rowIdx)
		var labels data.Labels
		for i := 0; i < len(stringFieldIdxs); i++ {
			if i == 0 {
				labels = make(data.Labels)
			}
			key := stringFieldNames[i] // TODO check for duplicate string column names
			val, _ := frame.ConcreteAt(stringFieldIdxs[i], rowIdx)
			labels[key] = val.(string) // TODO check assertion / return error
		}

		n := mathexp.NewNumber(frame.Fields[numericField].Name, labels)

		// The new value fields' configs gets pointed to the one in the original frame
		n.Frame.Fields[0].Config = frame.Fields[numericField].Config
		n.SetValue(&val)

		numbers[rowIdx] = n
	}
	return numbers, nil
}

// WideToMany converts a data package wide type Frame to one or multiple Series. A series
// is created for each value type column of wide frame.
//
// This might not be a good idea long term, but works now as an adapter/shim.
func WideToMany(frame *data.Frame, fixSeries func(series mathexp.Series, valueField *data.Field)) ([]mathexp.Series, error) {
	tsSchema := frame.TimeSeriesSchema()
	if tsSchema.Type != data.TimeSeriesTypeWide {
		return nil, fmt.Errorf("%w but got type %s", ErrSeriesMustBeWide, tsSchema.Type)
	}

	if len(tsSchema.ValueIndices) == 1 {
		s, err := mathexp.SeriesFromFrame(frame)
		if err != nil {
			return nil, err
		}
		if fixSeries != nil {
			fixSeries(s, frame.Fields[tsSchema.ValueIndices[0]])
		}
		return []mathexp.Series{s}, nil
	}

	series := make([]mathexp.Series, 0, len(tsSchema.ValueIndices))
	for _, valIdx := range tsSchema.ValueIndices {
		l := frame.Rows()
		f := data.NewFrameOfFieldTypes(frame.Name, l, frame.Fields[tsSchema.TimeIndex].Type(), frame.Fields[valIdx].Type())
		f.Fields[0].Name = frame.Fields[tsSchema.TimeIndex].Name
		f.Fields[1].Name = frame.Fields[valIdx].Name

		// The new value fields' configs gets pointed to the one in the original frame
		f.Fields[1].Config = frame.Fields[valIdx].Config

		if frame.Fields[valIdx].Labels != nil {
			f.Fields[1].Labels = frame.Fields[valIdx].Labels.Copy()
		}
		for i := 0; i < l; i++ {
			f.SetRow(i, frame.Fields[tsSchema.TimeIndex].CopyAt(i), frame.Fields[valIdx].CopyAt(i))
		}
		s, err := mathexp.SeriesFromFrame(f)
		if err != nil {
			return nil, err
		}
		if fixSeries != nil {
			fixSeries(s, frame.Fields[valIdx])
		}
		series = append(series, s)
	}

	return series, nil
}

// checkIfSeriesNeedToBeFixed scans all value fields of all provided frames and determines whether the resulting mathexp.Series
// needs to be updated so each series could be identifiable by labels.
// NOTE: applicable only to some datas ources (datasources.DS_GRAPHITE, datasources.DS_TESTDATA, etc.); a more general solution should be investigated
// returns a function that patches the mathexp.Series with information from data.Field from which it was created if the all series need to be fixed. Otherwise, returns nil
func checkIfSeriesNeedToBeFixed(frames []*data.Frame, datasourceType string) func(series mathexp.Series, valueField *data.Field) {
	supportedDatasources := []string{datasources.DS_GRAPHITE, datasources.DS_TESTDATA, datasources.DS_DYNATRACE, datasources.DS_INFLUXDB}
	checkdatasourceType := func(ds string) bool {
		return datasourceType == ds
	}
	if !slices.ContainsFunc(supportedDatasources, checkdatasourceType) {
		return nil
	}

	// get all value fields
	var valueFields []*data.Field
	for _, frame := range frames {
		tsSchema := frame.TimeSeriesSchema()
		for _, index := range tsSchema.ValueIndices {
			field := frame.Fields[index]
			// if at least one value field contains labels, the result does not need to be fixed.
			if len(field.Labels) > 0 {
				return nil
			}
			if valueFields == nil {
				valueFields = make([]*data.Field, 0, len(frames)*len(tsSchema.ValueIndices))
			}
			valueFields = append(valueFields, field)
		}
	}

	// selectors are in precedence order.
	nameSelectors := []func(f *data.Field) string{
		func(f *data.Field) string {
			if f == nil || f.Config == nil {
				return ""
			}
			return f.Config.DisplayNameFromDS
		},
		func(f *data.Field) string {
			if f == nil || f.Config == nil {
				return ""
			}
			return f.Config.DisplayName
		},
		func(f *data.Field) string {
			return f.Name
		},
	}

	// now look for the first selector that would make all value fields be unique
	for _, selector := range nameSelectors {
		names := make(map[string]struct{}, len(valueFields))
		good := true
		for _, field := range valueFields {
			name := selector(field)
			if _, ok := names[name]; ok || name == "" {
				good = false
				break
			}
			names[name] = struct{}{}
		}
		if good {
			return func(series mathexp.Series, valueField *data.Field) {
				series.SetLabels(data.Labels{
					nameLabelName: selector(valueField),
				})
			}
		}
	}
	return nil
}
