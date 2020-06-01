package azuremonitor

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func LogTableToFrame(table *AzureLogAnalyticsTable) (*data.Frame, error) {
	converterFrame, err := converterFrameForTable(table)
	if err != nil {
		return nil, err
	}
	for rowIdx, row := range table.Rows {
		for fieldIdx, field := range row {
			converterFrame.Set(fieldIdx, rowIdx, field)
		}
	}
	return converterFrame.Frame, nil
}

func converterFrameForTable(t *AzureLogAnalyticsTable) (*data.FrameInputConverter, error) {
	converters := []data.FieldConverter{}
	colNames := make([]string, len(t.Columns))

	for i, col := range t.Columns {
		colNames[i] = col.Name
		converter, ok := converterMap[col.Type]
		if !ok {
			return nil, fmt.Errorf("unsupported analytics column type %v", col.Type)
		}
		converters = append(converters, converter)
	}

	fic, err := data.NewFrameInputConverter(converters, len(t.Rows))
	if err != nil {
		return nil, err
	}

	fic.Frame.SetFieldNames(colNames...)

	return fic, nil
}

var converterMap = map[string]data.FieldConverter{
	"string":   stringConverter,
	"datetime": timeConverter,
	"real":     realConverter,
}

var stringConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableString,
	Converter: func(v interface{}) (interface{}, error) {
		var as *string
		if v == nil {
			return as, nil
		}
		s, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected string got %T", v)
		}
		as = &s
		return as, nil
	},
}

var timeConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableTime,
	Converter: func(v interface{}) (interface{}, error) {
		var at *time.Time
		if v == nil {
			return at, nil
		}
		s, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected string got %T", v)
		}
		t, err := time.Parse(time.RFC3339Nano, s)
		if err != nil {
			return nil, err
		}

		return &t, nil
	},
}

var realConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableFloat64,
	Converter: func(v interface{}) (interface{}, error) {
		var af *float64
		if v == nil {
			return af, nil
		}
		f, ok := v.(float64)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected float64 got %T", v)
		}
		af = &f
		return af, nil
	},
}
