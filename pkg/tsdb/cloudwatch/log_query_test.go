package cloudwatch

import (
	"fmt"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ***
// LogQuery tests
// ***

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
				&cloudwatchlogs.ResultField{
					Field: aws.String(logStreamIdentifierInternal),
					Value: aws.String("fakelogstream"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String(logIdentifierInternal),
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
				&cloudwatchlogs.ResultField{
					Field: aws.String(logStreamIdentifierInternal),
					Value: aws.String("fakelogstream"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String(logIdentifierInternal),
					Value: aws.String("fakelog"),
				},
			},
			// Sometimes cloudwatch returns empty row
			{},
			// or rows with only timestamp
			{
				&cloudwatchlogs.ResultField{
					Field: aws.String("@timestamp"),
					Value: aws.String("2020-03-02 17:04:05.000"),
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
				&cloudwatchlogs.ResultField{
					Field: aws.String(logStreamIdentifierInternal),
					Value: aws.String("fakelogstream"),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String(logIdentifierInternal),
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

	dataframes, err := logsResultsToDataframes(fakeCloudwatchResponse)
	require.NoError(t, err)
	timeA, err := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 15:04:05.000")
	require.NoError(t, err)
	timeB, err := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 16:04:05.000")
	require.NoError(t, err)
	timeC, err := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 17:04:05.000")
	require.NoError(t, err)
	timeVals := []*time.Time{
		&timeA, &timeB, &timeC,
	}
	timeField := data.NewField("@timestamp", nil, timeVals)
	timeField.SetConfig(&data.FieldConfig{DisplayName: "Time"})

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

	logField := data.NewField("@log", nil, []*string{
		aws.String("fakelog"),
		aws.String("fakelog"),
		aws.String("fakelog"),
	})

	hiddenLogStreamField := data.NewField(logStreamIdentifierInternal, nil, []*string{
		aws.String("fakelogstream"),
		aws.String("fakelogstream"),
		aws.String("fakelogstream"),
	})
	hiddenLogStreamField.SetConfig(&data.FieldConfig{
		Custom: map[string]any{
			"hidden": true,
		},
	})

	hiddenLogField := data.NewField(logIdentifierInternal, nil, []*string{
		aws.String("fakelog"),
		aws.String("fakelog"),
		aws.String("fakelog"),
	})
	hiddenLogField.SetConfig(&data.FieldConfig{
		Custom: map[string]any{
			"hidden": true,
		},
	})

	expectedDataframe := &data.Frame{
		Name: "CloudWatchLogsResponse",
		Fields: []*data.Field{
			timeField,
			lineField,
			logStreamField,
			logField,
			hiddenLogStreamField,
			hiddenLogField,
		},
		RefID: "",
		Meta: &data.FrameMeta{
			Custom: map[string]any{
				"Status": "ok",
			},
			Stats: []data.QueryStat{
				{
					FieldConfig: data.FieldConfig{DisplayName: "Bytes scanned"},
					Value:       2000,
				},
				{
					FieldConfig: data.FieldConfig{DisplayName: "Records scanned"},
					Value:       5000,
				},
				{
					FieldConfig: data.FieldConfig{DisplayName: "Records matched"},
					Value:       3,
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

func TestLogsResultsToDataframes_MixedTypes_NumericValuesMixedWithStringFallBackToStringValues(t *testing.T) {
	dataframes, err := logsResultsToDataframes(&cloudwatchlogs.GetQueryResultsOutput{
		Results: [][]*cloudwatchlogs.ResultField{
			{
				&cloudwatchlogs.ResultField{
					Field: aws.String("numberOrString"),
					Value: aws.String("-1.234"),
				},
			},
			{
				&cloudwatchlogs.ResultField{
					Field: aws.String("numberOrString"),
					Value: aws.String("1"),
				},
			},
			{
				&cloudwatchlogs.ResultField{
					Field: aws.String("numberOrString"),
					Value: aws.String("not a number"),
				},
			},
			{
				&cloudwatchlogs.ResultField{
					Field: aws.String("numberOrString"),
					Value: aws.String("2.000"),
				},
			},
		},
		Status: aws.String("ok"),
	})
	require.NoError(t, err)

	expectedDataframe := &data.Frame{
		Name: "CloudWatchLogsResponse",
		Fields: []*data.Field{
			data.NewField("numberOrString", nil, []*string{
				aws.String("-1.234"),
				aws.String("1"),
				aws.String("not a number"),
				aws.String("2.000"),
			}),
		},
		RefID: "",
		Meta: &data.FrameMeta{
			Custom: map[string]any{
				"Status": "ok",
			},
		},
	}

	assert.Equal(t, expectedDataframe.Name, dataframes.Name)
	assert.Equal(t, expectedDataframe.RefID, dataframes.RefID)
	assert.Equal(t, expectedDataframe.Meta, dataframes.Meta)
	assert.ElementsMatch(t, expectedDataframe.Fields, dataframes.Fields)
}

func TestLogsResultsToDataframes_With_Millisecond_Timestamps(t *testing.T) {
	stringTimeField := "2020-03-02 15:04:05.000"
	timestampField := int64(1732749534876)
	ingestionTimeField := int64(1732790372916)

	dataframes, err := logsResultsToDataframes(&cloudwatchlogs.GetQueryResultsOutput{
		Results: [][]*cloudwatchlogs.ResultField{
			{
				&cloudwatchlogs.ResultField{
					Field: aws.String("@timestamp"),
					Value: aws.String(fmt.Sprintf("%d", timestampField)),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("@ingestionTime"),
					Value: aws.String(fmt.Sprintf("%d", ingestionTimeField)),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("stringTimeField"),
					Value: aws.String(stringTimeField),
				},
				&cloudwatchlogs.ResultField{
					Field: aws.String("message"),
					Value: aws.String("log message"),
				},
			},
		},
		Status: aws.String("ok"),
	})
	require.NoError(t, err)

	timeStampResult := time.Unix(timestampField/1000, (timestampField%1000)*int64(time.Millisecond))
	ingestionTimeResult := time.Unix(ingestionTimeField/1000, (ingestionTimeField%1000)*int64(time.Millisecond))
	stringTimeFieldResult, err := time.Parse(cloudWatchTSFormat, stringTimeField)
	require.NoError(t, err)

	expectedDataframe := &data.Frame{
		Name: "CloudWatchLogsResponse",
		Fields: []*data.Field{
			data.NewField("@timestamp", nil, []*time.Time{
				&timeStampResult,
			}),
			data.NewField("@ingestionTime", nil, []*time.Time{
				&ingestionTimeResult,
			}),
			data.NewField("stringTimeField", nil, []*time.Time{
				&stringTimeFieldResult,
			}),
			data.NewField("message", nil, []*string{
				aws.String("log message"),
			}),
		},
		RefID: "",
		Meta: &data.FrameMeta{
			Custom: map[string]any{
				"Status": "ok",
			},
		},
	}
	expectedDataframe.Fields[0].SetConfig(&data.FieldConfig{DisplayName: "Time"})

	assert.Equal(t, expectedDataframe.Name, dataframes.Name)
	assert.Equal(t, expectedDataframe.RefID, dataframes.RefID)
	assert.Equal(t, expectedDataframe.Meta, dataframes.Meta)
	assert.ElementsMatch(t, expectedDataframe.Fields, dataframes.Fields)
}

func TestGroupKeyGeneration(t *testing.T) {
	logField := data.NewField("@log", data.Labels{}, []*string{
		aws.String("fakelog-a"),
		aws.String("fakelog-b"),
		aws.String("fakelog-c"),
		nil,
	})

	streamField := data.NewField("stream", data.Labels{}, []*string{
		aws.String("stream-a"),
		aws.String("stream-b"),
		aws.String("stream-c"),
		aws.String("stream-d"),
	})

	fakeFields := []*data.Field{logField, streamField}
	expectedKeys := []string{"fakelog-astream-a", "fakelog-bstream-b", "fakelog-cstream-c", "stream-d"}

	assert.Equal(t, expectedKeys[0], generateGroupKey(fakeFields, 0))
	assert.Equal(t, expectedKeys[1], generateGroupKey(fakeFields, 1))
	assert.Equal(t, expectedKeys[2], generateGroupKey(fakeFields, 2))
	assert.Equal(t, expectedKeys[3], generateGroupKey(fakeFields, 3))
}

func TestGroupingResults(t *testing.T) {
	timeA, err := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 15:04:05.000")
	require.NoError(t, err)
	timeB, err := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 16:04:05.000")
	require.NoError(t, err)
	timeC, err := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 17:04:05.000")
	require.NoError(t, err)
	timeVals := []*time.Time{
		&timeA, &timeA, &timeA, &timeB, &timeB, &timeB, &timeC, &timeC, &timeC,
	}
	timeField := data.NewField("@timestamp", data.Labels{}, timeVals)

	logField := data.NewField("@log", data.Labels{}, []*string{
		aws.String("fakelog-a"),
		aws.String("fakelog-b"),
		aws.String("fakelog-c"),
		aws.String("fakelog-a"),
		aws.String("fakelog-b"),
		aws.String("fakelog-c"),
		aws.String("fakelog-a"),
		aws.String("fakelog-b"),
		aws.String("fakelog-c"),
	})

	countField := data.NewField("count", data.Labels{}, []*string{
		aws.String("100"),
		aws.String("150"),
		aws.String("20"),
		aws.String("34"),
		aws.String("57"),
		aws.String("62"),
		aws.String("105"),
		aws.String("200"),
		aws.String("99"),
	})

	fakeDataFrame := &data.Frame{
		Name: "CloudWatchLogsResponse",
		Fields: []*data.Field{
			timeField,
			logField,
			countField,
		},
		RefID: "",
	}

	groupedTimeVals := []*time.Time{
		&timeA, &timeB, &timeC,
	}
	groupedTimeField := data.NewField("@timestamp", data.Labels{}, groupedTimeVals)
	groupedLogFieldA := data.NewField("@log", data.Labels{}, []*string{
		aws.String("fakelog-a"),
		aws.String("fakelog-a"),
		aws.String("fakelog-a"),
	})

	groupedCountFieldA := data.NewField("count", data.Labels{}, []*string{
		aws.String("100"),
		aws.String("34"),
		aws.String("105"),
	})

	groupedLogFieldB := data.NewField("@log", data.Labels{}, []*string{
		aws.String("fakelog-b"),
		aws.String("fakelog-b"),
		aws.String("fakelog-b"),
	})

	groupedCountFieldB := data.NewField("count", data.Labels{}, []*string{
		aws.String("150"),
		aws.String("57"),
		aws.String("200"),
	})

	groupedLogFieldC := data.NewField("@log", data.Labels{}, []*string{
		aws.String("fakelog-c"),
		aws.String("fakelog-c"),
		aws.String("fakelog-c"),
	})

	groupedCountFieldC := data.NewField("count", data.Labels{}, []*string{
		aws.String("20"),
		aws.String("62"),
		aws.String("99"),
	})

	expectedGroupedFrames := []*data.Frame{
		{
			Name: "fakelog-a",
			Fields: []*data.Field{
				groupedTimeField,
				groupedLogFieldA,
				groupedCountFieldA,
			},
			RefID: "",
		},
		{
			Name: "fakelog-b",
			Fields: []*data.Field{
				groupedTimeField,
				groupedLogFieldB,
				groupedCountFieldB,
			},
			RefID: "",
		},
		{
			Name: "fakelog-c",
			Fields: []*data.Field{
				groupedTimeField,
				groupedLogFieldC,
				groupedCountFieldC,
			},
			RefID: "",
		},
	}

	groupedResults, err := groupResults(fakeDataFrame, []string{"@log"}, false)
	require.NoError(t, err)
	assert.ElementsMatch(t, expectedGroupedFrames, groupedResults)
}

func TestGroupingResultsWithNumericField(t *testing.T) {
	timeA, err := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 15:04:05.000")
	require.NoError(t, err)
	timeB, err := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 16:04:05.000")
	require.NoError(t, err)
	timeC, err := time.Parse("2006-01-02 15:04:05.000", "2020-03-02 17:04:05.000")
	require.NoError(t, err)
	timeVals := []*time.Time{
		&timeA, &timeA, &timeA, &timeB, &timeB, &timeB, &timeC, &timeC, &timeC,
	}
	timeField := data.NewField("@timestamp", data.Labels{}, timeVals)

	httpResponseField := data.NewField("httpresponse", data.Labels{}, []*float64{
		aws.Float64(400),
		aws.Float64(404),
		aws.Float64(500),
		aws.Float64(400),
		aws.Float64(404),
		aws.Float64(500),
		aws.Float64(400),
		aws.Float64(404),
		aws.Float64(500),
	})

	countField := data.NewField("count", data.Labels{}, []*string{
		aws.String("100"),
		aws.String("150"),
		aws.String("20"),
		aws.String("34"),
		aws.String("57"),
		aws.String("62"),
		aws.String("105"),
		aws.String("200"),
		aws.String("99"),
	})

	fakeDataFrame := &data.Frame{
		Name: "CloudWatchLogsResponse",
		Fields: []*data.Field{
			timeField,
			httpResponseField,
			countField,
		},
		RefID: "",
	}

	groupedTimeVals := []*time.Time{
		&timeA, &timeB, &timeC,
	}
	groupedTimeField := data.NewField("@timestamp", data.Labels{}, groupedTimeVals)
	groupedHttpResponseFieldA := data.NewField("httpresponse", data.Labels{}, []*string{
		aws.String("400"),
		aws.String("400"),
		aws.String("400"),
	})

	groupedCountFieldA := data.NewField("count", data.Labels{}, []*string{
		aws.String("100"),
		aws.String("34"),
		aws.String("105"),
	})

	groupedHttpResponseFieldB := data.NewField("httpresponse", data.Labels{}, []*string{
		aws.String("404"),
		aws.String("404"),
		aws.String("404"),
	})

	groupedCountFieldB := data.NewField("count", data.Labels{}, []*string{
		aws.String("150"),
		aws.String("57"),
		aws.String("200"),
	})

	groupedHttpResponseFieldC := data.NewField("httpresponse", data.Labels{}, []*string{
		aws.String("500"),
		aws.String("500"),
		aws.String("500"),
	})

	groupedCountFieldC := data.NewField("count", data.Labels{}, []*string{
		aws.String("20"),
		aws.String("62"),
		aws.String("99"),
	})

	expectedGroupedFrames := []*data.Frame{
		{
			Name: "400",
			Fields: []*data.Field{
				groupedTimeField,
				groupedHttpResponseFieldA,
				groupedCountFieldA,
			},
			RefID: "",
		},
		{
			Name: "404",
			Fields: []*data.Field{
				groupedTimeField,
				groupedHttpResponseFieldB,
				groupedCountFieldB,
			},
			RefID: "",
		},
		{
			Name: "500",
			Fields: []*data.Field{
				groupedTimeField,
				groupedHttpResponseFieldC,
				groupedCountFieldC,
			},
			RefID: "",
		},
	}

	groupedResults, err := groupResults(fakeDataFrame, []string{"httpresponse"}, false)
	require.NoError(t, err)
	assert.ElementsMatch(t, expectedGroupedFrames, groupedResults)
}

func TestGroupingResultsWithFromSyncQueryTrue(t *testing.T) {
	logField := data.NewField("@log", data.Labels{}, []*string{
		aws.String("fakelog-a"),
		aws.String("fakelog-b"),
		aws.String("fakelog-a"),
		aws.String("fakelog-b"),
	})

	streamField := data.NewField("stream", data.Labels{}, []*int32{
		aws.Int32(1),
		aws.Int32(1),
		aws.Int32(1),
		aws.Int32(1),
	})

	countField := data.NewField("count", data.Labels{}, []*string{
		aws.String("100"),
		aws.String("150"),
		aws.String("57"),
		aws.String("62"),
	})

	timeA := time.Time{}
	timeB := time.Time{}.Add(1 * time.Minute)
	fakeDataFrame := &data.Frame{
		Name: "CloudWatchLogsResponse",
		Fields: []*data.Field{
			data.NewField("@timestamp", data.Labels{}, []*time.Time{&timeA, &timeA, &timeB, &timeB}),
			logField,
			streamField,
			countField,
		},
		RefID: "",
	}

	expectedGroupedFrames := []*data.Frame{
		{
			Name: "fakelog-a1",
			Fields: []*data.Field{
				data.NewField("@timestamp", data.Labels{}, []*time.Time{&timeA, &timeB}),
				data.NewField("count", data.Labels{"@log": "fakelog-a", "stream": "1"}, []*string{
					aws.String("100"),
					aws.String("57"),
				}),
			},
			RefID: "",
		},
		{
			Name: "fakelog-b1",
			Fields: []*data.Field{
				data.NewField("@timestamp", data.Labels{}, []*time.Time{&timeA, &timeB}),
				data.NewField("count", data.Labels{"@log": "fakelog-b", "stream": "1"}, []*string{
					aws.String("150"),
					aws.String("62"),
				}),
			},
			RefID: "",
		},
	}
	expectedGroupedFrames[0].Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: "fakelog-a1"}
	expectedGroupedFrames[1].Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: "fakelog-b1"}

	groupedResults, err := groupResults(fakeDataFrame, []string{"@log", "stream"}, true)
	require.NoError(t, err)
	assert.ElementsMatch(t, expectedGroupedFrames, groupedResults)
}
