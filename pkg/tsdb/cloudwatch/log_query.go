package cloudwatch

import (
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const cloudWatchTSFormat = "2006-01-02 15:04:05.000"

func logsResultsToDataframes(response *cloudwatchlogs.GetQueryResultsOutput) (*data.Frame, error) {
	if response == nil {
		return nil, fmt.Errorf("response is nil, cannot convert log results to data frames")
	}

	nonEmptyRows := make([][]*cloudwatchlogs.ResultField, 0)
	for _, row := range response.Results {
		// Sometimes CloudWatch can send empty rows
		if len(row) == 0 {
			continue
		}
		if len(row) == 1 {
			if row[0].Value == nil {
				continue
			}
			// Sometimes it sends rows with only timestamp
			if _, err := time.Parse(cloudWatchTSFormat, *row[0].Value); err == nil {
				continue
			}
		}
		nonEmptyRows = append(nonEmptyRows, row)
	}

	rowCount := len(nonEmptyRows)

	fieldValues := make(map[string]interface{})

	// Maintaining a list of field names in the order returned from CloudWatch
	// as just iterating over fieldValues would not give a consistent order
	fieldNames := make([]string, 0)

	for i, row := range nonEmptyRows {
		for _, resultField := range row {
			// Strip @ptr field from results as it's not needed
			if *resultField.Field == "@ptr" {
				continue
			}

			if _, exists := fieldValues[*resultField.Field]; !exists {
				fieldNames = append(fieldNames, *resultField.Field)

				// Check if it's a time field
				if _, err := time.Parse(cloudWatchTSFormat, *resultField.Value); err == nil {
					fieldValues[*resultField.Field] = make([]*time.Time, rowCount)
				} else if _, err := strconv.ParseFloat(*resultField.Value, 64); err == nil {
					fieldValues[*resultField.Field] = make([]*float64, rowCount)
				} else {
					fieldValues[*resultField.Field] = make([]*string, rowCount)
				}
			}

			if timeField, ok := fieldValues[*resultField.Field].([]*time.Time); ok {
				parsedTime, err := time.Parse(cloudWatchTSFormat, *resultField.Value)
				if err != nil {
					return nil, err
				}

				timeField[i] = &parsedTime
			} else if numericField, ok := fieldValues[*resultField.Field].([]*float64); ok {
				parsedFloat, err := strconv.ParseFloat(*resultField.Value, 64)

				if err != nil {
					// This can happen if a field has a mix of numeric and non-numeric values.
					// In that case, we change the field from a numeric field to a string field.
					fieldValues[*resultField.Field] = changeToStringField(rowCount, nonEmptyRows[:i+1], *resultField.Field)
					continue
				}

				numericField[i] = &parsedFloat
			} else {
				fieldValues[*resultField.Field].([]*string)[i] = resultField.Value
			}
		}
	}

	newFields := make([]*data.Field, 0, len(fieldNames))
	for _, fieldName := range fieldNames {
		newFields = append(newFields, data.NewField(fieldName, nil, fieldValues[fieldName]))

		if fieldName == "@timestamp" {
			newFields[len(newFields)-1].SetConfig(&data.FieldConfig{DisplayName: "Time"})
		} else if fieldName == logStreamIdentifierInternal || fieldName == logIdentifierInternal {
			newFields[len(newFields)-1].SetConfig(
				&data.FieldConfig{
					Custom: map[string]interface{}{
						"hidden": true,
					},
				},
			)
		}
	}

	queryStats := make([]data.QueryStat, 0)
	if response.Statistics != nil {
		if response.Statistics.BytesScanned != nil {
			queryStats = append(queryStats, data.QueryStat{
				FieldConfig: data.FieldConfig{DisplayName: "Bytes scanned"},
				Value:       *response.Statistics.BytesScanned,
			})
		}

		if response.Statistics.RecordsScanned != nil {
			queryStats = append(queryStats, data.QueryStat{
				FieldConfig: data.FieldConfig{DisplayName: "Records scanned"},
				Value:       *response.Statistics.RecordsScanned,
			})
		}

		if response.Statistics.RecordsMatched != nil {
			queryStats = append(queryStats, data.QueryStat{
				FieldConfig: data.FieldConfig{DisplayName: "Records matched"},
				Value:       *response.Statistics.RecordsMatched,
			})
		}
	}

	frame := data.NewFrame("CloudWatchLogsResponse", newFields...)
	frame.Meta = &data.FrameMeta{
		Stats:  nil,
		Custom: nil,
	}

	if len(queryStats) > 0 {
		frame.Meta.Stats = queryStats
	}

	if response.Status != nil {
		frame.Meta.Custom = map[string]interface{}{
			"Status": *response.Status,
		}
	}

	// Results aren't guaranteed to come ordered by time (ascending), so we need to sort
	sort.Sort(ByTime(*frame))
	return frame, nil
}

func changeToStringField(lengthOfValues int, rows [][]*cloudwatchlogs.ResultField, logEventField string) []*string {
	fieldValuesAsStrings := make([]*string, lengthOfValues)
	for i, resultFields := range rows {
		for _, field := range resultFields {
			if *field.Field == logEventField {
				fieldValuesAsStrings[i] = field.Value
			}
		}
	}

	return fieldValuesAsStrings
}

func groupResults(results *data.Frame, groupingFieldNames []string) ([]*data.Frame, error) {
	groupingFields := make([]*data.Field, 0)

	for i, field := range results.Fields {
		for _, groupingField := range groupingFieldNames {
			if field.Name == groupingField {
				// convert numeric grouping field to string field
				if field.Type().Numeric() {
					newField, err := numericFieldToStringField(field)
					if err != nil {
						return nil, err
					}
					results.Fields[i] = newField
					field = newField
				}

				groupingFields = append(groupingFields, field)
			}
		}
	}

	rowLength, err := results.RowLen()
	if err != nil {
		return nil, err
	}

	groupedDataFrames := make(map[string]*data.Frame)
	for i := 0; i < rowLength; i++ {
		groupKey := generateGroupKey(groupingFields, i)
		if _, exists := groupedDataFrames[groupKey]; !exists {
			newFrame := results.EmptyCopy()
			newFrame.Name = groupKey
			newFrame.Meta = results.Meta
			groupedDataFrames[groupKey] = newFrame
		}

		groupedDataFrames[groupKey].AppendRow(results.RowCopy(i)...)
	}

	newDataFrames := make([]*data.Frame, 0, len(groupedDataFrames))
	for _, dataFrame := range groupedDataFrames {
		newDataFrames = append(newDataFrames, dataFrame)
	}

	return newDataFrames, nil
}

func generateGroupKey(fields []*data.Field, row int) string {
	groupKey := ""
	for _, field := range fields {
		if strField, ok := field.At(row).(*string); ok {
			if strField != nil {
				groupKey += *strField
			}
		}
	}

	return groupKey
}

func numericFieldToStringField(field *data.Field) (*data.Field, error) {
	if !field.Type().Numeric() {
		return nil, fmt.Errorf("field is not numeric")
	}

	strings := make([]*string, field.Len())
	for i := 0; i < field.Len(); i++ {
		floatVal, err := field.FloatAt(i)
		if err != nil {
			return nil, err
		}

		strVal := fmt.Sprintf("%g", floatVal)
		strings[i] = aws.String(strVal)
	}

	newField := data.NewField(field.Name, field.Labels, strings)
	newField.Config = field.Config

	return newField, nil
}
