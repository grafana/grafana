package loganalytics

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLogTableToFrame(t *testing.T) {
	tests := []struct {
		name          string
		testFile      string
		expectedFrame func() *data.Frame
	}{
		{
			name:     "single series",
			testFile: "loganalytics/1-log-analytics-response-metrics-single-series.json",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("TimeGenerated", nil, []*time.Time{
						util.Pointer(time.Date(2020, 4, 19, 19, 16, 6, 5e8, time.UTC)),
						util.Pointer(time.Date(2020, 4, 19, 19, 16, 16, 5e8, time.UTC)),
						util.Pointer(time.Date(2020, 4, 19, 19, 16, 26, 5e8, time.UTC)),
					}),
					data.NewField("Computer", nil, []*string{
						util.Pointer("grafana-vm"),
						util.Pointer("grafana-vm"),
						util.Pointer("grafana-vm"),
					}),
					data.NewField("avg_CounterValue", nil, []*float64{
						util.Pointer(1.1),
						util.Pointer(2.2),
						util.Pointer(3.3),
					}),
				)
				frame.Meta = &data.FrameMeta{
					Custom: &LogAnalyticsMeta{ColumnTypes: []string{"datetime", "string", "real"}},
				}
				return frame
			},
		},
		{
			name:     "response table",
			testFile: "loganalytics/6-log-analytics-response-table.json",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("TenantId", nil, []*string{
						util.Pointer("a2c1b44e-3e57-4410-b027-6cc0ae6dee67"),
						util.Pointer("a2c1b44e-3e57-4410-b027-6cc0ae6dee67"),
						util.Pointer("a2c1b44e-3e57-4410-b027-6cc0ae6dee67"),
					}),
					data.NewField("Computer", nil, []*string{
						util.Pointer("grafana-vm"),
						util.Pointer("grafana-vm"),
						util.Pointer("grafana-vm"),
					}),
					data.NewField("ObjectName", nil, []*string{
						util.Pointer("Memory"),
						util.Pointer("Memory"),
						util.Pointer("Memory"),
					}),
					data.NewField("CounterName", nil, []*string{
						util.Pointer("Available MBytes Memory"),
						util.Pointer("Available MBytes Memory"),
						util.Pointer("Available MBytes Memory"),
					}),
					data.NewField("InstanceName", nil, []*string{
						util.Pointer("Memory"),
						util.Pointer("Memory"),
						util.Pointer("Memory"),
					}),
					data.NewField("Min", nil, []*float64{nil, nil, nil}),
					data.NewField("Max", nil, []*float64{nil, nil, nil}),
					data.NewField("SampleCount", nil, []*int32{nil, nil, nil}),
					data.NewField("CounterValue", nil, []*float64{
						util.Pointer(2040.0),
						util.Pointer(2066.0),
						util.Pointer(2066.0),
					}),
					data.NewField("TimeGenerated", nil, []*time.Time{
						util.Pointer(time.Date(2020, 4, 23, 11, 46, 3, 857e6, time.UTC)),
						util.Pointer(time.Date(2020, 4, 23, 11, 46, 13, 857e6, time.UTC)),
						util.Pointer(time.Date(2020, 4, 23, 11, 46, 23, 857e6, time.UTC)),
					}),
				)
				frame.Meta = &data.FrameMeta{
					Custom: &LogAnalyticsMeta{ColumnTypes: []string{"string", "string", "string",
						"string", "string", "real", "real", "int", "real", "datetime"}},
				}
				return frame
			},
		},
		{
			name:     "all supported field types",
			testFile: "loganalytics/7-log-analytics-all-types-table.json",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("XBool", nil, []*bool{util.Pointer(true)}),
					data.NewField("XString", nil, []*string{util.Pointer("Grafana")}),
					data.NewField("XDateTime", nil, []*time.Time{util.Pointer(time.Date(2006, 1, 2, 22, 4, 5, 1*1e8, time.UTC))}),
					data.NewField("XDynamic", nil, []*string{util.Pointer(`[{"person":"Daniel"},{"cats":23},{"diagnosis":"cat problem"}]`)}),
					data.NewField("XGuid", nil, []*string{util.Pointer("74be27de-1e4e-49d9-b579-fe0b331d3642")}),
					data.NewField("XInt", nil, []*int32{util.Pointer(int32(2147483647))}),
					data.NewField("XLong", nil, []*int64{util.Pointer(int64(9223372036854775807))}),
					data.NewField("XReal", nil, []*float64{util.Pointer(1.797693134862315708145274237317043567981e+308)}),
					data.NewField("XTimeSpan", nil, []*string{util.Pointer("00:00:00.0000001")}),
					data.NewField("XDecimal", nil, []*float64{util.Pointer(79228162514264337593543950335.0)}),
					data.NewField("XObject", nil, []*string{util.Pointer(`"{\"person\": \"Daniel\", \"cats\": 23, \"diagnosis\": \"cat problem\"}"`)}),
					data.NewField("XNumber", nil, []*float64{util.Pointer(79228162514264337593543950335.0)}),
				)
				frame.Meta = &data.FrameMeta{
					Custom: &LogAnalyticsMeta{ColumnTypes: []string{"bool", "string", "datetime",
						"dynamic", "guid", "int", "long", "real", "timespan", "decimal", "object", "number"}},
				}
				return frame
			},
		},
		{
			name:     "nan and infinity in real response",
			testFile: "loganalytics/8-log-analytics-response-nan-inf.json",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("XInf", nil, []*float64{util.Pointer(math.Inf(0))}),
					data.NewField("XInfNeg", nil, []*float64{util.Pointer(math.Inf(-2))}),
					data.NewField("XNan", nil, []*float64{util.Pointer(math.NaN())}),
				)
				frame.Meta = &data.FrameMeta{
					Custom: &LogAnalyticsMeta{ColumnTypes: []string{"real", "real", "real"}},
				}
				return frame
			},
		},
		{
			name:     "data and error in real response",
			testFile: "loganalytics/9-log-analytics-response-error.json",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("OperationName", nil, []*string{util.Pointer("Create or Update Virtual Machine")}),
					data.NewField("Level", nil, []*string{util.Pointer("Informational")}),
				)
				frame.Meta = &data.FrameMeta{
					Custom:  &LogAnalyticsMeta{ColumnTypes: []string{"string", "string"}},
					Notices: []data.Notice{{Severity: data.NoticeSeverityError, Text: "There were some errors when processing your query. Something went wrong processing your query on the server. The results of this query exceed the set limit of 1 records."}},
				}
				return frame
			},
		},
		{
			name:     "data and warning in real response",
			testFile: "loganalytics/10-log-analytics-response-warning.json",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("OperationName", nil, []*string{util.Pointer("Create or Update Virtual Machine")}),
					data.NewField("Level", nil, []*string{util.Pointer("Informational")}),
				)
				frame.Meta = &data.FrameMeta{
					Custom:  &LogAnalyticsMeta{ColumnTypes: []string{"string", "string"}},
					Notices: []data.Notice{{Severity: data.NoticeSeverityWarning, Text: "There were some errors when processing your query. Something went wrong processing your query on the server. Not sure what happened."}},
				}
				return frame
			},
		},
		{
			name:     "empty data response",
			testFile: "loganalytics/11-log-analytics-response-empty.json",
			expectedFrame: func() *data.Frame {
				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := loadLogAnalyticsTestFileWithNumber(t, tt.testFile)
			frame, err := ResponseTableToFrame(&res.Tables[0], "A", "query")
			appendErrorNotice(frame, res.Error)
			require.NoError(t, err)

			if diff := cmp.Diff(tt.expectedFrame(), frame, data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func loadLogAnalyticsTestFileWithNumber(t *testing.T, name string) AzureLogAnalyticsResponse {
	t.Helper()
	path := filepath.Join("../testdata", name)
	// Ignore gosec warning G304 since it's a test
	// nolint:gosec
	f, err := os.Open(path)
	require.NoError(t, err)
	defer func() {
		err := f.Close()
		assert.NoError(t, err)
	}()

	d := json.NewDecoder(f)
	d.UseNumber()
	var data AzureLogAnalyticsResponse
	err = d.Decode(&data)
	require.NoError(t, err)
	return data
}
