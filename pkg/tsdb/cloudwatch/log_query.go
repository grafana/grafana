package cloudwatch

import (
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
)

func logsResultsToDataframes(response *cloudwatchlogs.GetQueryResultsOutput) (*dataframe.Frame, error) {
	rowCount := len(response.Results)
	fieldValues := make(map[string][]*string)
	for i, row := range response.Results {
		for _, resultField := range row {
			// Strip @ptr field from results as it's not really needed
			if *resultField.Field == "@ptr" {
				continue
			}

			if _, exists := fieldValues[*resultField.Field]; !exists {
				fieldValues[*resultField.Field] = make([]*string, rowCount)
			}

			fieldValues[*resultField.Field][i] = resultField.Value
		}
	}

	newFields := make([]*dataframe.Field, 0)
	for fieldName, vals := range fieldValues {
		newFields = append(newFields, dataframe.NewField(fieldName, nil, vals))

		if fieldName == "@timestamp" {
			newFields[len(newFields)-1].SetConfig(&dataframe.FieldConfig{Title: "Time"})
		}
	}

	frame := dataframe.New("CloudWatchLogsResponse", newFields...)
	frame.Meta = &dataframe.QueryResultMeta{
		Custom: map[string]interface{}{
			"Status":     *response.Status,
			"Statistics": *response.Statistics,
		},
	}
	return frame, nil
}
