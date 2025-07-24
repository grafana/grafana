package cloudwatch

import (
	"fmt"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	cloudwatchlogstypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ***
// LogQuery tests
// ***

func TestLogsResultsToDataframes(t *testing.T) {
	fakeCloudwatchResponse := &cloudwatchlogs.GetQueryResultsOutput{
		Results: [][]cloudwatchlogstypes.ResultField{
			{
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@ptr"),
					Value: aws.String("fake ptr"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@timestamp"),
					Value: aws.String("2020-03-02 15:04:05.000"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("line"),
					Value: aws.String("test message 1"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@logStream"),
					Value: aws.String("fakelogstream"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@log"),
					Value: aws.String("fakelog"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String(logStreamIdentifierInternal),
					Value: aws.String("fakelogstream"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String(logIdentifierInternal),
					Value: aws.String("fakelog"),
				},
			},
			{
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@ptr"),
					Value: aws.String("fake ptr"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@timestamp"),
					Value: aws.String("2020-03-02 16:04:05.000"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("line"),
					Value: aws.String("test message 2"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@logStream"),
					Value: aws.String("fakelogstream"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@log"),
					Value: aws.String("fakelog"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String(logStreamIdentifierInternal),
					Value: aws.String("fakelogstream"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String(logIdentifierInternal),
					Value: aws.String("fakelog"),
				},
			},
			// Sometimes cloudwatch returns empty row
			{},
			// or rows with only timestamp
			{
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@timestamp"),
					Value: aws.String("2020-03-02 17:04:05.000"),
				},
			},
			{
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@ptr"),
					Value: aws.String("fake ptr"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@timestamp"),
					Value: aws.String("2020-03-02 17:04:05.000"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("line"),
					Value: aws.String("test message 3"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@logStream"),
					Value: aws.String("fakelogstream"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@log"),
					Value: aws.String("fakelog"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String(logStreamIdentifierInternal),
					Value: aws.String("fakelogstream"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String(logIdentifierInternal),
					Value: aws.String("fakelog"),
				},
			},
		},
		Status: "ok",
		Statistics: &cloudwatchlogstypes.QueryStatistics{
			BytesScanned:   2000,
			RecordsMatched: 3,
			RecordsScanned: 5000,
		},
	}

	dataframes, err := logsResultsToDataframes(fakeCloudwatchResponse, []string{})
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
		Results: [][]cloudwatchlogstypes.ResultField{
			{
				cloudwatchlogstypes.ResultField{
					Field: aws.String("numberOrString"),
					Value: aws.String("-1.234"),
				},
			},
			{
				cloudwatchlogstypes.ResultField{
					Field: aws.String("numberOrString"),
					Value: aws.String("1"),
				},
			},
			{
				cloudwatchlogstypes.ResultField{
					Field: aws.String("numberOrString"),
					Value: aws.String("not a number"),
				},
			},
			{
				cloudwatchlogstypes.ResultField{
					Field: aws.String("numberOrString"),
					Value: aws.String("2.000"),
				},
			},
		},
		Status: "ok",
	}, []string{})
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
		Results: [][]cloudwatchlogstypes.ResultField{
			{
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@timestamp"),
					Value: aws.String(fmt.Sprintf("%d", timestampField)),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@ingestionTime"),
					Value: aws.String(fmt.Sprintf("%d", ingestionTimeField)),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("stringTimeField"),
					Value: aws.String(stringTimeField),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("message"),
					Value: aws.String("log message"),
				},
			},
		},
		Status: "ok",
	}, []string{})
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

func TestLogsResultsToDataframes_With_Int_Grouping_Field(t *testing.T) {
	timestampField := int64(1732749534876)

	dataframes, err := logsResultsToDataframes(&cloudwatchlogs.GetQueryResultsOutput{
		Results: [][]cloudwatchlogstypes.ResultField{
			{
				cloudwatchlogstypes.ResultField{
					Field: aws.String("@timestamp"),
					Value: aws.String(fmt.Sprintf("%d", timestampField)),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("numberField"),
					Value: aws.String("8"),
				},
				cloudwatchlogstypes.ResultField{
					Field: aws.String("groupingNumber"),
					Value: aws.String("100"),
				},
			},
		},
		Status: "ok",
	}, []string{"groupingNumber"})
	require.NoError(t, err)

	timeStampResult := time.Unix(timestampField/1000, (timestampField%1000)*int64(time.Millisecond))
	require.NoError(t, err)

	expectedDataframe := &data.Frame{
		Name: "CloudWatchLogsResponse",
		Fields: []*data.Field{
			data.NewField("@timestamp", nil, []*time.Time{
				&timeStampResult,
			}),
			data.NewField("numberField", nil, []*float64{aws.Float64(8)}),
			data.NewField("groupingNumber", nil, []*string{
				aws.String("100"),
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

func TestGroupingResultsWithFromSyncQueryTrue(t *testing.T) {
	logField := data.NewField("@log", data.Labels{}, []*string{
		aws.String("fakelog-a"),
		aws.String("fakelog-b"),
		aws.String("fakelog-a"),
		aws.String("fakelog-b"),
	})

	streamField := data.NewField("stream", data.Labels{}, []*string{
		aws.String("1"),
		aws.String("1"),
		aws.String("1"),
		aws.String("1"),
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
