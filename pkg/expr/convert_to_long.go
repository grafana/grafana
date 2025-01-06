package expr

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func ConvertToLong(frames data.Frames) (data.Frames, error) {
	if len(frames) == 0 {
		// general empty case for now
		return frames, nil
	}
	// Four Conversion Possible Cases
	// 1. NumericMulti -> NumericLong
	// 2. NumericWide -> NumericLong
	// 3. TimeSeriesMulti -> TimeSeriesLong
	// 4. TimeSeriesWide -> TimeSeriesLong

	// Detect if input type is declared
	// First Check Frame Meta Type

	var inputType data.FrameType
	if frames[0].Meta != nil && frames[0].Meta.Type != "" {
		inputType = frames[0].Meta.Type
	}
	if inputType != "" && !supportedToLongConversion(inputType) {
		return frames, fmt.Errorf("unsupported input type %s for SQL expression", inputType)
	}

	// TODO: Add some guessing of Type if not declared

	if inputType == "" {
		return frames, fmt.Errorf("could not determine input type")
	}

	convert := getToLongConversionFunc(inputType)
	if convert == nil {
		return frames, fmt.Errorf("could not get conversion function for input type %s", inputType)
	}

	return convert(frames)
}

func convertNumericMultiToNumericLong(frames data.Frames) (data.Frames, error) {
	return nil, fmt.Errorf("not implemented")
}

func convertNumericWideToNumericLong(frames data.Frames) (data.Frames, error) {
	// Wide should only be one frame
	if len(frames) != 1 {
		return nil, fmt.Errorf("expected exactly one frame for wide format, but got %d", len(frames))
	}
	inputFrame := frames[0]

	// The Frame should have no more than one row
	if inputFrame.Rows() > 1 {
		return nil, fmt.Errorf("expected no more than one row in the frame, but got %d", inputFrame.Rows())
	}

	// Gather Unique Label Keys from each numeric, and unique numeric field names,
	// each one maps to a field in the output long Frame.
	uniqueNames := make([]string, 0)
	uniqueKeys := make([]string, 0)

	uniqueNamesMap := make(map[string]data.FieldType)
	uniqueKeysMap := make(map[string]struct{})

	prints := make(map[string]int)

	registerPrint := func(labels data.Labels) {
		fp := labels.Fingerprint().String()
		if _, ok := prints[fp]; !ok {
			prints[fp] = len(prints)
		}
	}

	for _, field := range inputFrame.Fields {
		if field.Type().Numeric() {
			if _, ok := uniqueNamesMap[field.Name]; !ok {
				uniqueNames = append(uniqueNames, field.Name)
			}
			uniqueNamesMap[field.Name] = field.Type()

			if field.Labels != nil {
				for key := range field.Labels {
					if _, ok := uniqueKeysMap[key]; !ok {
						uniqueKeys = append(uniqueKeys, key)
					}
					uniqueKeysMap[key] = struct{}{}
					registerPrint(field.Labels)
				}
			}
		}
	}

	// Create new fields for output Long frame
	fields := make([]*data.Field, 0, len(uniqueNames)+len(uniqueKeys))

	// Create the Numeric Fields, tracking the index of each field by name
	// Note: May want to use FloatAt and and prepopulate with NaN so missing
	// combinations of value can be NA instead of the zero value of 0.
	var nameIndexMap = make(map[string]int, len(uniqueNames))
	for i, name := range uniqueNames {
		field := data.NewFieldFromFieldType(uniqueNamesMap[name], len(prints))
		field.Name = name
		fields = append(fields, field)
		nameIndexMap[name] = i
	}

	// Create the String field, tracking the index of each field by key
	var keyIndexMap = make(map[string]int, len(uniqueKeys))
	for i, k := range uniqueKeys {
		fields = append(fields, data.NewField(k, nil, make([]string, len(prints))))
		keyIndexMap[k] = len(nameIndexMap) + i
	}

	longFrame := data.NewFrame("", fields...)

	if inputFrame.Rows() == 0 {
		return data.Frames{longFrame}, nil
	}

	// Add Rows to the fields
	for _, field := range inputFrame.Fields {
		if !field.Type().Numeric() {
			continue
		}
		rowIdx := prints[field.Labels.Fingerprint().String()]
		longFrame.Fields[nameIndexMap[field.Name]].Set(rowIdx, field.At(0))
		for key, value := range field.Labels {
			longFrame.Fields[keyIndexMap[key]].Set(rowIdx, value)
		}
	}

	// Create new Frame
	return data.Frames{longFrame}, nil

}

func convertTimeSeriesMultiToTimeSeriesLong(frames data.Frames) (data.Frames, error) {
	return nil, fmt.Errorf("not implemented")
}

func convertTimeSeriesWideToTimeSeriesLong(frames data.Frames) (data.Frames, error) {
	// Wide should only be one frame
	if len(frames) != 1 {
		return nil, fmt.Errorf("expected exactly one frame for wide format, but got %d", len(frames))
	}
	inputFrame := frames[0]
	longFrame, err := data.WideToLong(inputFrame)
	if err != nil {
		return nil, fmt.Errorf("failed to convert wide time series to long timeseries for sql expression: %w", err)
	}
	return data.Frames{longFrame}, nil
}

func getToLongConversionFunc(inputType data.FrameType) func(data.Frames) (data.Frames, error) {
	switch inputType {
	case data.FrameTypeNumericMulti:
		return convertNumericMultiToNumericLong
	case data.FrameTypeNumericWide:
		return convertNumericWideToNumericLong
	case data.FrameTypeTimeSeriesMulti:
		return convertTimeSeriesMultiToTimeSeriesLong
	case data.FrameTypeTimeSeriesWide:
		return convertTimeSeriesWideToTimeSeriesLong
	}
	return nil
}

func supportedToLongConversion(inputType data.FrameType) bool {
	switch inputType {
	case data.FrameTypeNumericMulti:
		return true
	case data.FrameTypeNumericWide:
		return true
	case data.FrameTypeTimeSeriesMulti:
		return true
	case data.FrameTypeTimeSeriesWide:
		return true
	}
	return false
}
