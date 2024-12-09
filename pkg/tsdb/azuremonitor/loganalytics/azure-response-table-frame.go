package loganalytics

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func apiErrorToNotice(err *AzureLogAnalyticsAPIError) data.Notice {
	message := []string{}
	severity := data.NoticeSeverityWarning
	if err.Message != nil {
		message = append(message, *err.Message)
	}
	if err.Details != nil && len(*err.Details) > 0 {
		for _, detail := range *err.Details {
			if detail.Message != nil {
				message = append(message, *detail.Message)
			}
			if detail.Innererror != nil {
				if detail.Innererror.Message != nil {
					message = append(message, *detail.Innererror.Message)
				}
				if detail.Innererror.SeverityName != nil && *detail.Innererror.SeverityName == "Error" {
					// Severity names are not documented in the API response format
					// https://docs.microsoft.com/en-us/azure/azure-monitor/logs/api/response-format
					// so assuming either an error or a warning
					severity = data.NoticeSeverityError
				}
			}
		}
	}
	return data.Notice{
		Severity: severity,
		Text:     strings.Join(message, " "),
	}
}

// ResponseTableToFrame converts an AzureResponseTable to a data.Frame.
func ResponseTableToFrame(table *types.AzureResponseTable, refID string, executedQuery string, queryType dataquery.AzureQueryType, resultFormat dataquery.ResultFormat, logLimitDisabled bool) (*data.Frame, error) {
	if len(table.Rows) == 0 {
		return nil, nil
	}

	converterFrame, err := converterFrameForTable(table, queryType, resultFormat, logLimitDisabled)
	if err != nil {
		return nil, err
	}
	for rowIdx, row := range table.Rows {
		for fieldIdx, field := range row {
			err = converterFrame.Set(fieldIdx, rowIdx, field)
			if err != nil {
				return nil, err
			}
		}
	}

	return converterFrame.Frame, nil
}

func converterFrameForTable(t *types.AzureResponseTable, queryType dataquery.AzureQueryType, resultFormat dataquery.ResultFormat, logLimitDisabled bool) (*data.FrameInputConverter, error) {
	converters := []data.FieldConverter{}
	colNames := make([]string, len(t.Columns))
	colTypes := make([]string, len(t.Columns)) // for metadata

	for i, col := range t.Columns {
		colNames[i] = col.Name
		colTypes[i] = col.Type
		converter, ok := converterMap[col.Type]
		if !ok {
			return nil, fmt.Errorf("unsupported analytics column type %v", col.Type)
		}
		if (queryType == dataquery.AzureQueryTypeAzureTraces || queryType == dataquery.AzureQueryTypeTraceql) && resultFormat == dataquery.ResultFormatTrace && (col.Name == "serviceTags" || col.Name == "tags") {
			converter = tagsConverter
		}
		converters = append(converters, converter)
	}

	rowLimit := 30000
	limitExceeded := false
	if len(t.Rows) > rowLimit && resultFormat == dataquery.ResultFormatLogs && !logLimitDisabled {
		// We limit the number of rows to 30k to prevent crashing the browser tab as the logs viz is not virtualised.
		t.Rows = t.Rows[:rowLimit]
		limitExceeded = true
	}

	fic, err := data.NewFrameInputConverter(converters, len(t.Rows))
	if err != nil {
		return nil, err
	}

	err = fic.Frame.SetFieldNames(colNames...)
	if err != nil {
		return nil, err
	}

	fic.Frame.Meta = &data.FrameMeta{
		Custom: &LogAnalyticsMeta{ColumnTypes: colTypes},
	}

	if limitExceeded {
		fic.Frame.AppendNotices(data.Notice{
			Severity: data.NoticeSeverityWarning,
			Text:     "The number of results in the result set has been limited to 30,000.",
		})
	}

	return fic, nil
}

var converterMap = map[string]data.FieldConverter{
	"string":   stringConverter,
	"guid":     stringConverter,
	"timespan": stringConverter,
	"dynamic":  stringConverter,
	"object":   objectToStringConverter,
	"datetime": timeConverter,
	"int":      intConverter,
	"long":     longConverter,
	"real":     realConverter,
	"bool":     boolConverter,
	"decimal":  decimalConverter,
	"integer":  intConverter,
	"number":   decimalConverter,
}

type KeyValue struct {
	Value any    `json:"value"`
	Key   string `json:"key"`
}

var tagsConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableJSON,
	Converter: func(v any) (any, error) {
		if v == nil {
			return nil, nil
		}

		m := map[string]any{}
		err := json.Unmarshal([]byte(v.(string)), &m)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal trace tags: %s", err)
		}

		parsedTags := []KeyValue{}
		for k, v := range m {
			if v == nil {
				continue
			}

			switch v.(type) {
			case float64:
				if v == 0 {
					continue
				}
			case string:
				if v == "" {
					continue
				}
			}

			parsedTags = append(parsedTags, KeyValue{Key: k, Value: v})
		}
		sort.Slice(parsedTags, func(i, j int) bool {
			return parsedTags[i].Key < parsedTags[j].Key
		})

		marshalledTags, err := json.Marshal(parsedTags)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal parsed trace tags: %s", err)
		}

		jsonTags := json.RawMessage(marshalledTags)

		return &jsonTags, nil
	},
}

var stringConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableString,
	Converter: func(v any) (any, error) {
		var as *string
		if v == nil {
			return as, nil
		}
		s, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected string but got %T", v)
		}
		as = &s
		return as, nil
	},
}

var objectToStringConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableString,
	Converter: func(kustoValue any) (any, error) {
		var output *string
		if kustoValue == nil {
			return output, nil
		}

		data, err := json.Marshal(kustoValue)
		if err != nil {
			fmt.Printf("failed to marshal column value: %s", err)
		}

		asString := string(data)
		output = &asString

		return output, nil
	},
}

var timeConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableTime,
	Converter: func(v any) (any, error) {
		var at *time.Time
		if v == nil {
			return at, nil
		}
		s, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected string but got %T", v)
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
	Converter: func(v any) (any, error) {
		var af *float64
		if v == nil {
			return af, nil
		}
		jN, ok := v.(json.Number)
		if !ok {
			s, sOk := v.(string)
			if sOk {
				switch s {
				case "Infinity":
					f := math.Inf(0)
					return &f, nil
				case "-Infinity":
					f := math.Inf(-1)
					return &f, nil
				case "NaN":
					f := math.NaN()
					return &f, nil
				}
			}
			return nil, fmt.Errorf("unexpected type, expected json.Number but got type %T for value %v", v, v)
		}
		f, err := jN.Float64()
		if err != nil {
			return nil, err
		}
		return &f, err
	},
}

var boolConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableBool,
	Converter: func(v any) (any, error) {
		var ab *bool
		if v == nil {
			return ab, nil
		}
		b, ok := v.(bool)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected bool but got %T", v)
		}
		return &b, nil
	},
}

var intConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableInt32,
	Converter: func(v any) (any, error) {
		var ai *int32
		if v == nil {
			return ai, nil
		}
		jN, ok := v.(json.Number)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected json.Number but got %T", v)
		}
		var err error
		iv, err := strconv.ParseInt(jN.String(), 10, 32)
		if err != nil {
			return nil, err
		}
		aInt := int32(iv)
		return &aInt, nil
	},
}

var longConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableInt64,
	Converter: func(v any) (any, error) {
		var ai *int64
		if v == nil {
			return ai, nil
		}
		jN, ok := v.(json.Number)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected json.Number but got %T", v)
		}
		out, err := jN.Int64()
		if err != nil {
			return nil, err
		}
		return &out, err
	},
}

// decimalConverter converts the Kusto 128-bit type number to
// a float64. We do not have 128 bit numbers in our dataframe
// model yet (and even if we did, not sure how javascript would handle them).
// In the future, we may want to revisit storing this will proper precision,
// but for now it solves the case of people getting an error response.
// If we were to keep it a string, it would not work correctly with calls
// to functions like sdk's data.LongToWide.
var decimalConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableFloat64,
	Converter: func(v any) (any, error) {
		var af *float64
		if v == nil {
			return af, nil
		}

		jS, sOk := v.(string)
		if sOk {
			out, err := strconv.ParseFloat(jS, 64)
			if err != nil {
				return nil, err
			}
			return &out, err
		}

		// As far as I can tell this always comes in a string, but this is in the
		// ADX code, so leaving this in case values do sometimes become a number somehow.
		jN, nOk := v.(json.Number)
		if !nOk {
			return nil, fmt.Errorf("unexpected type, expected json.Number or string but got type %T with a value of %v", v, v)
		}
		out, err := jN.Float64() // Float64 calls strconv.ParseFloat64
		if err != nil {
			return nil, err
		}
		return &out, nil
	},
}
