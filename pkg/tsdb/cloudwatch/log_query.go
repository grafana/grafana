package cloudwatch

import (
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func logsResultsToDataframes(response *cloudwatchlogs.GetQueryResultsOutput) (*data.Frame, error) {
	rowCount := len(response.Results)
	fieldValues := make(map[string]interface{})

	// Maintaining a list of field names in the order returned from CloudWatch
	// as just iterating over fieldValues would not give a consistent order
	fieldNames := make([]*string, 0)

	for i, row := range response.Results {
		for _, resultField := range row {
			// Strip @ptr field from results as it's not needed
			if *resultField.Field == "@ptr" {
				continue
			}

			if _, exists := fieldValues[*resultField.Field]; !exists {
				fieldNames = append(fieldNames, resultField.Field)

				// Check if field is time field
				if _, err := time.Parse(CLOUDWATCH_TS_FORMAT, *resultField.Value); err == nil {
					fieldValues[*resultField.Field] = make([]*time.Time, rowCount)
				} else {
					fieldValues[*resultField.Field] = make([]*string, rowCount)
				}
			}

			if timeField, ok := fieldValues[*resultField.Field].([]*time.Time); ok {
				parsedTime, err := time.Parse(CLOUDWATCH_TS_FORMAT, *resultField.Value)
				if err != nil {
					return nil, err
				}

				timeField[i] = &parsedTime
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
		} else if *fieldName == "@logStream" || *fieldName == "@log" {
			newFields[len(newFields)-1].SetConfig(
				&data.FieldConfig{
					Custom: map[string]interface{}{
						"Hidden": true,
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
		groupKey += *field.At(row).(*string)
	}

	return groupKey
}
