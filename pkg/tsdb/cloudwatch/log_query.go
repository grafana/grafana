package cloudwatch

import (
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func logsResultsToDataframes(response *cloudwatchlogs.GetQueryResultsOutput) (*data.Frame, error) {
	rowCount := len(response.Results)
	fieldValues := make(map[string]interface{})
	for i, row := range response.Results {
		for _, resultField := range row {
			// Strip @ptr field from results as it's not needed
			if *resultField.Field == "@ptr" {
				continue
			}

			if *resultField.Field == "@timestamp" {
				if _, exists := fieldValues[*resultField.Field]; !exists {
					fieldValues[*resultField.Field] = make([]*time.Time, rowCount)
				}

				parsedTime, err := time.Parse(cloudWatchTSFormat, *resultField.Value)
				if err != nil {
					return nil, err
				}

				fieldValues[*resultField.Field].([]*time.Time)[i] = &parsedTime
			} else {
				if _, exists := fieldValues[*resultField.Field]; !exists {
					// Check if field is time field
					if _, err := time.Parse(cloudWatchTSFormat, *resultField.Value); err == nil {
						fieldValues[*resultField.Field] = make([]*time.Time, rowCount)
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
				} else {
					fieldValues[*resultField.Field].([]*string)[i] = resultField.Value
				}
			}
		}
	}

	newFields := make([]*data.Field, 0)
	for fieldName, vals := range fieldValues {
		newFields = append(newFields, data.NewField(fieldName, nil, vals))

		if fieldName == "@timestamp" {
			newFields[len(newFields)-1].SetConfig(&data.FieldConfig{Title: "Time"})
		} else if fieldName == "@logStream" || fieldName == "@log" {
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
