package cloudwatch

import (
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/stretchr/testify/assert"
)

//***
// LogQuery tests
//***

func TestLogsResultsToDataframes(t *testing.T) {
	fakeCloudwatchResponse := &cloudwatchlogs.GetQueryResultsOutput{
		Results: [][]*cloudwatchlogs.ResultField{
			{
				&cloudwatchlogs.ResultField{
					Field: aws.String("@ptr"),
					Value: aws.String("fake ptr"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("@timestamp"),
					Value: aws.String("2020-03-02 15:04:05.000"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("line"),
					Value: aws.String("test message 1"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("@logStream"),
					Value: aws.String("fakelogstream"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("@log"),
					Value: aws.String("fakelog"),
				},
			},
			{
				&cloudwatchlogs.ResultField{
					Field: aws.String("@ptr"),
					Value: aws.String("fake ptr"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("@timestamp"),
					Value: aws.String("2020-03-02 16:04:05.000"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("line"),
					Value: aws.String("test message 2"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("@logStream"),
					Value: aws.String("fakelogstream"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("@log"),
					Value: aws.String("fakelog"),
				},
			},
			{
				&cloudwatchlogs.ResultField{
					Field: aws.String("@ptr"),
					Value: aws.String("fake ptr"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("@timestamp"),
					Value: aws.String("2020-03-02 17:04:05.000"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("line"),
					Value: aws.String("test message 3"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("@logStream"),
					Value: aws.String("fakelogstream"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("@log"),
					Value: aws.String("fakelog"),
				},
			},
		},
		Status: aws.String("ok"),
		Statistics: &cloudwatchlogs.QueryStatistics{
			BytesScanned:   aws.Float64(2000),
			RecordsMatched: aws.Float64(3),
			RecordsScanned: aws.Float64(5000),
		},
	}

	dataframes, _ := logsResultsToDataframes(fakeCloudwatchResponse)
	timeA, _ := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 15:04:05.000")
	timeB, _ := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 16:04:05.000")
	timeC, _ := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 17:04:05.000")
	timeVals := []*time.Time{
		&timeA, &timeB, &timeC,
	}
	timeField := data.NewField("@timestamp", nil, timeVals)
	timeField.SetConfig(&data.FieldConfig{Title: "Time"})

	lineField := data.NewField("line", nil, []*string{
		aws.String("test message 1"),
		aws.String("test message 2"),
		aws.String("test message 3"),
	})

	logStreamField := data.NewField("@logStream", nil, []*string{
		aws.String("fakelogstream"),
		aws.String("fakelogstream"),
		aws.String("fakelogstream"),
	})
	logStreamField.SetConfig(&data.FieldConfig{
		Custom: map[string]interface{}{
			"Hidden": true,
		},
	})

	logField := data.NewField("@log", nil, []*string{
		aws.String("fakelog"),
		aws.String("fakelog"),
		aws.String("fakelog"),
	})
	logField.SetConfig(&data.FieldConfig{
		Custom: map[string]interface{}{
			"Hidden": true,
		},
	})

	expectedDataframe := &data.Frame{
		Name: "CloudWatchLogsResponse",
		Fields: []*data.Field{
			timeField,
			lineField,
			logStreamField,
			logField,
		},
		RefID: "",
		Meta: &data.FrameMeta{
			Custom: map[string]interface{}{
				"Status": "ok",
				"Statistics": cloudwatchlogs.QueryStatistics{
					BytesScanned:   aws.Float64(2000),
					RecordsMatched: aws.Float64(3),
					RecordsScanned: aws.Float64(5000),
				},
			},
		},
	}

	// Splitting these assertions up so it's clearer what's wrong should the test
	// fail in the future
	assert.Equal(t, expectedDataframe.Name, dataframes.Name)
	assert.Equal(t, expectedDataframe.RefID, dataframes.RefID)
	assert.Equal(t, expectedDataframe.Meta, dataframes.Meta)
	assert.ElementsMatch(t, expectedDataframe.Fields, dataframes.Fields)
}
