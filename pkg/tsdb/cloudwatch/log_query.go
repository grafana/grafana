package cloudwatch

import (
	"sort"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func logsResultsToDataframes(response *cloudwatchlogs.GetQueryResultsOutput) (*data.Frame, error) {
	nonEmptyRows := make([][]*cloudwatchlogs.ResultField, 0)
	// Sometimes CloudWatch can send empty rows
	for _, row := range response.Results {
		if len(row) == 0 {
			continue
		}
		if len(row) == 1 {
			if row[0].Value == nil {
				continue
			}
			// Sometimes it sends row with only timestamp
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
	fieldNames := make([]*string, 0)

	for i, row := range nonEmptyRows {
		for _, resultField := range row {
			// Strip @ptr field from results as it's not needed
			if *resultField.Field == "@ptr" {
				continue
			}

			if _, exists := fieldValues[*resultField.Field]; !exists {
				fieldNames = append(fieldNames, resultField.Field)

				// Check if field is time field
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
					return nil, err
				}
				numericField[i] = &parsedFloat
			} else {
				fieldValues[*resultField.Field].([]*string)[i] = resultField.Value
			}
		}
	}

	newFields := make([]*data.Field, 0)
	for _, fieldName := range fieldNames {
		newFields = append(newFields, data.NewField(*fieldName, nil, fieldValues[*fieldName]))

		if *fieldName == "@timestamp" {
			newFields[len(newFields)-1].SetConfig(&data.FieldConfig{Title: "Time"})
		} else if *fieldName == LOGSTREAM_IDENTIFIER_INTERNAL || *fieldName == LOG_IDENTIFIER_INTERNAL {
			newFields[len(newFields)-1].SetConfig(
				&data.FieldConfig{
					Custom: map[string]interface{}{
						"hidden": true,
					},
				},
			)
		}
	}

	frame := data.NewFrame("CloudWatchLogsResponse", newFields...)
	frame.Meta = &data.FrameMeta{
		Custom: map[string]interface{}{
			"Status":     *response.Status,
			"Statistics": *response.Statistics,
		},
	}

	// Results aren't guaranteed to come ordered by time (ascending), so we need to sort
	sort.Sort(ByTime(*frame))
	return frame, nil
}

func groupResults(results *data.Frame, groupingFieldNames []string) ([]*data.Frame, error) {
	groupingFields := make([]*data.Field, 0)

	for _, field := range results.Fields {
		for _, groupingField := range groupingFieldNames {
			if field.Name == groupingField {
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
