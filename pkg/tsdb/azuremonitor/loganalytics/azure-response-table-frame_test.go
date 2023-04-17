package loganalytics

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
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
			res := loadTestFileWithNumber(t, tt.testFile)
			frame, err := ResponseTableToFrame(&res.Tables[0], "A", "query", dataquery.AzureQueryTypeAzureLogAnalytics, dataquery.ResultFormatTable)
			appendErrorNotice(frame, res.Error)
			require.NoError(t, err)

			if diff := cmp.Diff(tt.expectedFrame(), frame, data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func marshalJSONData(v interface{}) *json.RawMessage {
	marshalled, err := json.Marshal(v)
	if err != nil {
		panic(fmt.Errorf("error marshalling data: %s", err))
	}

	raw := json.RawMessage(marshalled)
	return &raw
}

func TestTraceTableToFrame(t *testing.T) {
	tests := []struct {
		name          string
		testFile      string
		expectedFrame func() *data.Frame
		resultFormat  dataquery.ResultFormat
	}{
		{
			name:     "multi trace",
			testFile: "traces/1-traces-multiple-table.json",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("traceID", nil, []*string{
						util.Pointer("cfae497bfd7a44169f35643940820938"),
						util.Pointer("e766f18a0adc49418d297b1a244f1bfb"),
						util.Pointer("b1f0047386554fa59b7c5330560a0799"),
					}),
					data.NewField("spanID", nil, []*string{
						util.Pointer("b52403c5-5b27-43a8-9bc6-5938667a4470"),
						util.Pointer("|e766f18a0adc49418d297b1a244f1bfb.1901."),
						util.Pointer("|b1f0047386554fa59b7c5330560a0799."),
					}),
					data.NewField("parentSpanID", nil, []*string{
						util.Pointer("|cfae497bfd7a44169f35643940820938."),
						util.Pointer("|e766f18a0adc49418d297b1a244f1bfb."),
						util.Pointer("b1f0047386554fa59b7c5330560a0799"),
					}),
					data.NewField("duration", nil, []*float64{
						util.Pointer(float64(0)),
						util.Pointer(float64(330)),
						util.Pointer(float64(352)),
					}),
					data.NewField("serviceName", nil, []*string{
						util.Pointer(""),
						util.Pointer("GET /repos/grafana/grafana/commits"),
						util.Pointer("GET /github/grafana/grafana/commits"),
					}),
					data.NewField("operationName", nil, []*string{
						util.Pointer("GET /github/grafana/grafana/commits"),
						util.Pointer("GET /github/grafana/grafana/commits"),
						util.Pointer("GET /github/grafana/grafana/commits"),
					}),
					data.NewField("startTime", nil, []*time.Time{
						util.Pointer(time.Date(2023, 04, 17, 14, 58, 10, 176000000, time.UTC)),
						util.Pointer(time.Date(2023, 04, 17, 14, 58, 10, 764000000, time.UTC)),
						util.Pointer(time.Date(2023, 04, 17, 14, 58, 11, 579000000, time.UTC)),
					}),
					data.NewField("serviceTags", nil, []*string{
						util.Pointer("{\"service\":\"github-test-data\",\"limit\":\"5000\",\"remaining\":\"4351\",\"reset\":\"1681746512\",\"used\":\"649\",\"timestamp\":\"2023-04-17T14:58:10.0000000Z\"}"),
						nil,
						nil,
					}),
					data.NewField("tags", nil, []*string{
						util.Pointer("{\"client_IP\":\"0.0.0.0\",\"operation_Id\":\"cfae497bfd7a44169f35643940820938\",\"duration\":0,\"iKey\":\"195b4fe4-7b01-4814-abca-ffceb1f62c8f\",\"size\":null,\"sdkVersion\":\"node:1.8.9\",\"name\":\"\",\"client_Model\":\"\",\"cloud_RoleName\":\"Web\",\"customMeasurements\":null,\"client_Browser\":\"\",\"operation_Name\":\"GET /github/grafana/grafana/commits\",\"performanceBucket\":\"\",\"client_CountryOrRegion\":\"Ireland\",\"cloud_RoleInstance\":\"test-vm\",\"appName\":\"test-app\",\"client_Type\":\"PC\",\"operation_ParentId\":\"|cfae497bfd7a44169f35643940820938.\",\"success\":\"\",\"application_Version\":\"1.0.0\",\"operation_SyntheticSource\":\"\",\"itemType\":\"trace\",\"user_AccountId\":\"\",\"session_Id\":\"\",\"timestamp\":\"2023-04-17T14:58:10.1760000Z\",\"message\":\"github commits rate limiting info\",\"client_City\":\"Dublin\",\"client_StateOrProvince\":\"Dublin\",\"itemId\":\"65863e6b-dd30-11ed-a808-002248268105\",\"client_OS\":\"Linux 5.4.0-1036-azure\",\"id\":\"\",\"customDimensions\":{\"service\":\"github-test-data\",\"limit\":\"5000\",\"remaining\":\"4351\",\"reset\":\"1681746512\",\"used\":\"649\",\"timestamp\":\"2023-04-17T14:58:10.0000000Z\"},\"itemCount\":1,\"location\":\"\",\"user_AuthenticatedId\":\"\",\"appId\":\"4ad5a808-11f7-49d5-9713-f6ede83141e4\",\"user_Id\":\"\",\"resultCode\":\"\",\"type\":\"\",\"data\":\"\",\"target\":\"\",\"assembly\":\"\",\"outerType\":\"\",\"innermostAssembly\":\"\",\"innermostType\":\"\",\"method\":\"\",\"problemId\":\"\",\"handledAt\":\"\",\"outerMessage\":\"\",\"details\":null,\"innermostMethod\":\"\",\"innermostMessage\":\"\",\"outerAssembly\":\"\",\"outerMethod\":\"\",\"severityLevel\":1,\"url\":\"\",\"source\":\"\"}"),
						util.Pointer("{\"client_IP\":\"0.0.0.0\",\"operation_Id\":\"e766f18a0adc49418d297b1a244f1bfb\",\"duration\":330,\"iKey\":\"195b4fe4-7b01-4814-abca-ffceb1f62c8f\",\"size\":null,\"sdkVersion\":\"node:1.8.9\",\"name\":\"GET /repos/grafana/grafana/commits\",\"client_Model\":\"\",\"cloud_RoleName\":\"Web\",\"customMeasurements\":null,\"client_Browser\":\"\",\"operation_Name\":\"GET /github/grafana/grafana/commits\",\"performanceBucket\":\"250ms-500ms\",\"client_CountryOrRegion\":\"Ireland\",\"cloud_RoleInstance\":\"test-vm\",\"appName\":\"test-app\",\"client_Type\":\"PC\",\"operation_ParentId\":\"|e766f18a0adc49418d297b1a244f1bfb.\",\"success\":\"True\",\"application_Version\":\"1.0.0\",\"operation_SyntheticSource\":\"\",\"itemType\":\"dependency\",\"user_AccountId\":\"\",\"session_Id\":\"\",\"timestamp\":\"2023-04-17T14:58:10.7640000Z\",\"message\":\"\",\"client_City\":\"Dublin\",\"client_StateOrProvince\":\"Dublin\",\"itemId\":\"78c1bcf4-dd30-11ed-a808-0022481f7f28\",\"client_OS\":\"Linux 5.4.0-1036-azure\",\"id\":\"|e766f18a0adc49418d297b1a244f1bfb.1901.\",\"customDimensions\":null,\"itemCount\":1,\"location\":\"\",\"user_AuthenticatedId\":\"\",\"appId\":\"4ad5a808-11f7-49d5-9713-f6ede83141e4\",\"user_Id\":\"\",\"resultCode\":\"200\",\"type\":\"HTTP\",\"data\":\"https://api.github.com/repos/grafana/grafana/commits\",\"target\":\"api.github.com\",\"assembly\":\"\",\"outerType\":\"\",\"innermostAssembly\":\"\",\"innermostType\":\"\",\"method\":\"\",\"problemId\":\"\",\"handledAt\":\"\",\"outerMessage\":\"\",\"details\":null,\"innermostMethod\":\"\",\"innermostMessage\":\"\",\"outerAssembly\":\"\",\"outerMethod\":\"\",\"severityLevel\":null,\"url\":\"\",\"source\":\"\"}"),
						util.Pointer("{\"client_IP\":\"0.0.0.0\",\"operation_Id\":\"b1f0047386554fa59b7c5330560a0799\",\"duration\":352,\"iKey\":\"195b4fe4-7b01-4814-abca-ffceb1f62c8f\",\"size\":null,\"sdkVersion\":\"node:1.8.9\",\"name\":\"GET /github/grafana/grafana/commits\",\"client_Model\":\"\",\"cloud_RoleName\":\"Web\",\"customMeasurements\":null,\"client_Browser\":\"\",\"operation_Name\":\"GET /github/grafana/grafana/commits\",\"performanceBucket\":\"250ms-500ms\",\"client_CountryOrRegion\":\"\",\"cloud_RoleInstance\":\"test-vm\",\"appName\":\"test-app\",\"client_Type\":\"PC\",\"operation_ParentId\":\"b1f0047386554fa59b7c5330560a0799\",\"success\":\"True\",\"application_Version\":\"1.0.0\",\"operation_SyntheticSource\":\"\",\"itemType\":\"request\",\"user_AccountId\":\"\",\"session_Id\":\"\",\"timestamp\":\"2023-04-17T14:58:11.5790000Z\",\"message\":\"\",\"client_City\":\"\",\"client_StateOrProvince\":\"\",\"itemId\":\"5c126241-dd30-11ed-a80a-00224826882d\",\"client_OS\":\"Linux 5.4.0-1036-azure\",\"id\":\"|b1f0047386554fa59b7c5330560a0799.\",\"customDimensions\":null,\"itemCount\":1,\"location\":\"\",\"user_AuthenticatedId\":\"\",\"appId\":\"4ad5a808-11f7-49d5-9713-f6ede83141e4\",\"user_Id\":\"\",\"resultCode\":\"200\",\"type\":\"\",\"data\":\"\",\"target\":\"\",\"assembly\":\"\",\"outerType\":\"\",\"innermostAssembly\":\"\",\"innermostType\":\"\",\"method\":\"\",\"problemId\":\"\",\"handledAt\":\"\",\"outerMessage\":\"\",\"details\":null,\"innermostMethod\":\"\",\"innermostMessage\":\"\",\"outerAssembly\":\"\",\"outerMethod\":\"\",\"severityLevel\":null,\"url\":\"test-url\",\"source\":\"\"}"),
					}),
					data.NewField("itemId", nil, []*string{
						util.Pointer("65863e6b-dd30-11ed-a808-002248268105"),
						util.Pointer("78c1bcf4-dd30-11ed-a808-0022481f7f28"),
						util.Pointer("5c126241-dd30-11ed-a80a-00224826882d"),
					}),
					data.NewField("itemType", nil, []*string{
						util.Pointer("trace"),
						util.Pointer("dependency"),
						util.Pointer("request"),
					}),
				)
				frame.Meta = &data.FrameMeta{
					Custom: &LogAnalyticsMeta{ColumnTypes: []string{"string", "string", "string", "real", "string", "string", "datetime", "dynamic", "dynamic", "string", "string"}},
				}
				return frame
			},
			resultFormat: dataquery.ResultFormatTable,
		},
		{
			name:     "multi trace as trace format",
			testFile: "traces/1-traces-multiple-table.json",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("traceID", nil, []*string{
						util.Pointer("cfae497bfd7a44169f35643940820938"),
						util.Pointer("e766f18a0adc49418d297b1a244f1bfb"),
						util.Pointer("b1f0047386554fa59b7c5330560a0799"),
					}),
					data.NewField("spanID", nil, []*string{
						util.Pointer("b52403c5-5b27-43a8-9bc6-5938667a4470"),
						util.Pointer("|e766f18a0adc49418d297b1a244f1bfb.1901."),
						util.Pointer("|b1f0047386554fa59b7c5330560a0799."),
					}),
					data.NewField("parentSpanID", nil, []*string{
						util.Pointer("|cfae497bfd7a44169f35643940820938."),
						util.Pointer("|e766f18a0adc49418d297b1a244f1bfb."),
						util.Pointer("b1f0047386554fa59b7c5330560a0799"),
					}),
					data.NewField("duration", nil, []*float64{
						util.Pointer(float64(0)),
						util.Pointer(float64(330)),
						util.Pointer(float64(352)),
					}),
					data.NewField("serviceName", nil, []*string{
						util.Pointer(""),
						util.Pointer("GET /repos/grafana/grafana/commits"),
						util.Pointer("GET /github/grafana/grafana/commits"),
					}),
					data.NewField("operationName", nil, []*string{
						util.Pointer("GET /github/grafana/grafana/commits"),
						util.Pointer("GET /github/grafana/grafana/commits"),
						util.Pointer("GET /github/grafana/grafana/commits"),
					}),
					data.NewField("startTime", nil, []*time.Time{
						util.Pointer(time.Date(2023, 04, 17, 14, 58, 10, 176000000, time.UTC)),
						util.Pointer(time.Date(2023, 04, 17, 14, 58, 10, 764000000, time.UTC)),
						util.Pointer(time.Date(2023, 04, 17, 14, 58, 11, 579000000, time.UTC)),
					}),
					data.NewField("serviceTags", nil, []*json.RawMessage{
						marshalJSONData([]KeyValue{
							{Value: "5000", Key: "limit"},
							{Value: "4351", Key: "remaining"},
							{Value: "1681746512", Key: "reset"},
							{Value: "github-test-data", Key: "service"},
							{Value: "2023-04-17T14:58:10.0000000Z", Key: "timestamp"},
							{Value: "649", Key: "used"},
						}),
						nil,
						nil,
					}),
					data.NewField("tags", nil, []*json.RawMessage{
						marshalJSONData([]KeyValue{
							{Value: "4ad5a808-11f7-49d5-9713-f6ede83141e4", Key: "appId"},
							{Value: "test-app", Key: "appName"},
							{Value: "1.0.0", Key: "application_Version"},
							{Value: "Dublin", Key: "client_City"},
							{Value: "Ireland", Key: "client_CountryOrRegion"},
							{Value: "0.0.0.0", Key: "client_IP"},
							{Value: "Linux 5.4.0-1036-azure", Key: "client_OS"},
							{Value: "Dublin", Key: "client_StateOrProvince"},
							{Value: "PC", Key: "client_Type"},
							{Value: "test-vm", Key: "cloud_RoleInstance"},
							{Value: "Web", Key: "cloud_RoleName"},
							{
								Value: map[string]interface{}{
									"limit":     "5000",
									"remaining": "4351",
									"reset":     "1681746512",
									"service":   "github-test-data",
									"timestamp": "2023-04-17T14:58:10.0000000Z",
									"used":      "649",
								},
								Key: "customDimensions",
							},
							{Value: 0, Key: "duration"},
							{Value: "195b4fe4-7b01-4814-abca-ffceb1f62c8f", Key: "iKey"},
							{Value: 1, Key: "itemCount"},
							{Value: "65863e6b-dd30-11ed-a808-002248268105", Key: "itemId"},
							{Value: "trace", Key: "itemType"},
							{Value: "github commits rate limiting info", Key: "message"},
							{Value: "cfae497bfd7a44169f35643940820938", Key: "operation_Id"},
							{Value: "GET /github/grafana/grafana/commits", Key: "operation_Name"},
							{
								Value: "|cfae497bfd7a44169f35643940820938.",
								Key:   "operation_ParentId",
							},
							{Value: "node:1.8.9", Key: "sdkVersion"},
							{Value: 1, Key: "severityLevel"},
							{Value: "2023-04-17T14:58:10.1760000Z", Key: "timestamp"},
						}),
						marshalJSONData([]KeyValue{
							{Value: "4ad5a808-11f7-49d5-9713-f6ede83141e4", Key: "appId"},
							{Value: "test-app", Key: "appName"},
							{Value: "1.0.0", Key: "application_Version"},
							{Value: "Dublin", Key: "client_City"},
							{Value: "Ireland", Key: "client_CountryOrRegion"},
							{Value: "0.0.0.0", Key: "client_IP"},
							{Value: "Linux 5.4.0-1036-azure", Key: "client_OS"},
							{Value: "Dublin", Key: "client_StateOrProvince"},
							{Value: "PC", Key: "client_Type"},
							{Value: "test-vm", Key: "cloud_RoleInstance"},
							{Value: "Web", Key: "cloud_RoleName"},
							{
								Value: "https://api.github.com/repos/grafana/grafana/commits",
								Key:   "data",
							},
							{Value: 330, Key: "duration"},
							{Value: "195b4fe4-7b01-4814-abca-ffceb1f62c8f", Key: "iKey"},
							{Value: "|e766f18a0adc49418d297b1a244f1bfb.1901.", Key: "id"},
							{Value: 1, Key: "itemCount"},
							{Value: "78c1bcf4-dd30-11ed-a808-0022481f7f28", Key: "itemId"},
							{Value: "dependency", Key: "itemType"},
							{Value: "GET /repos/grafana/grafana/commits", Key: "name"},
							{Value: "e766f18a0adc49418d297b1a244f1bfb", Key: "operation_Id"},
							{Value: "GET /github/grafana/grafana/commits", Key: "operation_Name"},
							{
								Value: "|e766f18a0adc49418d297b1a244f1bfb.",
								Key:   "operation_ParentId",
							},
							{Value: "250ms-500ms", Key: "performanceBucket"},
							{Value: "200", Key: "resultCode"},
							{Value: "node:1.8.9", Key: "sdkVersion"},
							{Value: "True", Key: "success"},
							{Value: "api.github.com", Key: "target"},
							{Value: "2023-04-17T14:58:10.7640000Z", Key: "timestamp"},
							{Value: "HTTP", Key: "type"},
						}),
						marshalJSONData([]KeyValue{
							{Value: "4ad5a808-11f7-49d5-9713-f6ede83141e4", Key: "appId"},
							{Value: "test-app", Key: "appName"},
							{Value: "1.0.0", Key: "application_Version"},
							{Value: "0.0.0.0", Key: "client_IP"},
							{Value: "Linux 5.4.0-1036-azure", Key: "client_OS"},
							{Value: "PC", Key: "client_Type"},
							{Value: "test-vm", Key: "cloud_RoleInstance"},
							{Value: "Web", Key: "cloud_RoleName"},
							{Value: 352, Key: "duration"},
							{Value: "195b4fe4-7b01-4814-abca-ffceb1f62c8f", Key: "iKey"},
							{Value: "|b1f0047386554fa59b7c5330560a0799.", Key: "id"},
							{Value: 1, Key: "itemCount"},
							{Value: "5c126241-dd30-11ed-a80a-00224826882d", Key: "itemId"},
							{Value: "request", Key: "itemType"},
							{Value: "GET /github/grafana/grafana/commits", Key: "name"},
							{Value: "b1f0047386554fa59b7c5330560a0799", Key: "operation_Id"},
							{Value: "GET /github/grafana/grafana/commits", Key: "operation_Name"},
							{Value: "b1f0047386554fa59b7c5330560a0799", Key: "operation_ParentId"},
							{Value: "250ms-500ms", Key: "performanceBucket"},
							{Value: "200", Key: "resultCode"},
							{Value: "node:1.8.9", Key: "sdkVersion"},
							{Value: "True", Key: "success"},
							{Value: "2023-04-17T14:58:11.5790000Z", Key: "timestamp"},
							{Value: "test-url", Key: "url"},
						}),
					}),
					data.NewField("itemId", nil, []*string{
						util.Pointer("65863e6b-dd30-11ed-a808-002248268105"),
						util.Pointer("78c1bcf4-dd30-11ed-a808-0022481f7f28"),
						util.Pointer("5c126241-dd30-11ed-a80a-00224826882d"),
					}),
					data.NewField("itemType", nil, []*string{
						util.Pointer("trace"),
						util.Pointer("dependency"),
						util.Pointer("request"),
					}),
				)
				frame.Meta = &data.FrameMeta{
					Custom: &LogAnalyticsMeta{ColumnTypes: []string{"string", "string", "string", "real", "string", "string", "datetime", "dynamic", "dynamic", "string", "string"}},
				}
				return frame
			},
			resultFormat: dataquery.ResultFormatTrace,
		},
		{
			name:     "single trace",
			testFile: "traces/2-traces-single-table.json",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("traceID", nil, []*string{
						util.Pointer("cfae497bfd7a44169f35643940820938"),
					}),
					data.NewField("spanID", nil, []*string{
						util.Pointer("b52403c5-5b27-43a8-9bc6-5938667a4470"),
					}),
					data.NewField("parentSpanID", nil, []*string{
						util.Pointer("|cfae497bfd7a44169f35643940820938."),
					}),
					data.NewField("duration", nil, []*float64{
						util.Pointer(float64(0)),
					}),
					data.NewField("serviceName", nil, []*string{
						util.Pointer(""),
					}),
					data.NewField("operationName", nil, []*string{
						util.Pointer("GET /github/grafana/grafana/commits"),
					}),
					data.NewField("startTime", nil, []*time.Time{
						util.Pointer(time.Date(2023, 04, 17, 14, 58, 10, 176000000, time.UTC)),
					}),
					data.NewField("serviceTags", nil, []*string{
						util.Pointer("{\"service\":\"github-test-data\",\"limit\":\"5000\",\"remaining\":\"4351\",\"reset\":\"1681746512\",\"used\":\"649\",\"timestamp\":\"2023-04-17T14:58:10.0000000Z\"}"),
					}),
					data.NewField("tags", nil, []*string{
						util.Pointer("{\"client_IP\":\"0.0.0.0\",\"operation_Id\":\"cfae497bfd7a44169f35643940820938\",\"duration\":0,\"iKey\":\"195b4fe4-7b01-4814-abca-ffceb1f62c8f\",\"size\":null,\"sdkVersion\":\"node:1.8.9\",\"name\":\"\",\"client_Model\":\"\",\"cloud_RoleName\":\"Web\",\"customMeasurements\":null,\"client_Browser\":\"\",\"operation_Name\":\"GET /github/grafana/grafana/commits\",\"performanceBucket\":\"\",\"client_CountryOrRegion\":\"Ireland\",\"cloud_RoleInstance\":\"test-vm\",\"appName\":\"test-app\",\"client_Type\":\"PC\",\"operation_ParentId\":\"|cfae497bfd7a44169f35643940820938.\",\"success\":\"\",\"application_Version\":\"1.0.0\",\"operation_SyntheticSource\":\"\",\"itemType\":\"trace\",\"user_AccountId\":\"\",\"session_Id\":\"\",\"timestamp\":\"2023-04-17T14:58:10.1760000Z\",\"message\":\"github commits rate limiting info\",\"client_City\":\"Dublin\",\"client_StateOrProvince\":\"Dublin\",\"itemId\":\"65863e6b-dd30-11ed-a808-002248268105\",\"client_OS\":\"Linux 5.4.0-1036-azure\",\"id\":\"\",\"customDimensions\":{\"service\":\"github-test-data\",\"limit\":\"5000\",\"remaining\":\"4351\",\"reset\":\"1681746512\",\"used\":\"649\",\"timestamp\":\"2023-04-17T14:58:10.0000000Z\"},\"itemCount\":1,\"location\":\"\",\"user_AuthenticatedId\":\"\",\"appId\":\"4ad5a808-11f7-49d5-9713-f6ede83141e4\",\"user_Id\":\"\",\"resultCode\":\"\",\"type\":\"\",\"data\":\"\",\"target\":\"\",\"assembly\":\"\",\"outerType\":\"\",\"innermostAssembly\":\"\",\"innermostType\":\"\",\"method\":\"\",\"problemId\":\"\",\"handledAt\":\"\",\"outerMessage\":\"\",\"details\":null,\"innermostMethod\":\"\",\"innermostMessage\":\"\",\"outerAssembly\":\"\",\"outerMethod\":\"\",\"severityLevel\":1,\"url\":\"\",\"source\":\"\"}"),
					}),
					data.NewField("itemId", nil, []*string{
						util.Pointer("65863e6b-dd30-11ed-a808-002248268105"),
					}),
					data.NewField("itemType", nil, []*string{
						util.Pointer("trace"),
					}),
				)
				frame.Meta = &data.FrameMeta{
					Custom: &LogAnalyticsMeta{ColumnTypes: []string{"string", "string", "string", "real", "string", "string", "datetime", "dynamic", "dynamic", "string", "string"}},
				}
				return frame
			},
			resultFormat: dataquery.ResultFormatTable,
		},
		{
			name:     "single trace as trace format",
			testFile: "traces/2-traces-single-table.json",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("traceID", nil, []*string{
						util.Pointer("cfae497bfd7a44169f35643940820938"),
					}),
					data.NewField("spanID", nil, []*string{
						util.Pointer("b52403c5-5b27-43a8-9bc6-5938667a4470"),
					}),
					data.NewField("parentSpanID", nil, []*string{
						util.Pointer("|cfae497bfd7a44169f35643940820938."),
					}),
					data.NewField("duration", nil, []*float64{
						util.Pointer(float64(0)),
					}),
					data.NewField("serviceName", nil, []*string{
						util.Pointer(""),
					}),
					data.NewField("operationName", nil, []*string{
						util.Pointer("GET /github/grafana/grafana/commits"),
					}),
					data.NewField("startTime", nil, []*time.Time{
						util.Pointer(time.Date(2023, 04, 17, 14, 58, 10, 176000000, time.UTC)),
					}),
					data.NewField("serviceTags", nil, []*json.RawMessage{
						marshalJSONData([]KeyValue{
							{Value: "5000", Key: "limit"},
							{Value: "4351", Key: "remaining"},
							{Value: "1681746512", Key: "reset"},
							{Value: "github-test-data", Key: "service"},
							{Value: "2023-04-17T14:58:10.0000000Z", Key: "timestamp"},
							{Value: "649", Key: "used"},
						}),
					}),
					data.NewField("tags", nil, []*json.RawMessage{
						marshalJSONData([]KeyValue{
							{Value: "4ad5a808-11f7-49d5-9713-f6ede83141e4", Key: "appId"},
							{Value: "test-app", Key: "appName"},
							{Value: "1.0.0", Key: "application_Version"},
							{Value: "Dublin", Key: "client_City"},
							{Value: "Ireland", Key: "client_CountryOrRegion"},
							{Value: "0.0.0.0", Key: "client_IP"},
							{Value: "Linux 5.4.0-1036-azure", Key: "client_OS"},
							{Value: "Dublin", Key: "client_StateOrProvince"},
							{Value: "PC", Key: "client_Type"},
							{Value: "test-vm", Key: "cloud_RoleInstance"},
							{Value: "Web", Key: "cloud_RoleName"},
							{
								Value: map[string]interface{}{
									"limit":     "5000",
									"remaining": "4351",
									"reset":     "1681746512",
									"service":   "github-test-data",
									"timestamp": "2023-04-17T14:58:10.0000000Z",
									"used":      "649",
								},
								Key: "customDimensions",
							},
							{Value: 0, Key: "duration"},
							{Value: "195b4fe4-7b01-4814-abca-ffceb1f62c8f", Key: "iKey"},
							{Value: 1, Key: "itemCount"},
							{Value: "65863e6b-dd30-11ed-a808-002248268105", Key: "itemId"},
							{Value: "trace", Key: "itemType"},
							{Value: "github commits rate limiting info", Key: "message"},
							{Value: "cfae497bfd7a44169f35643940820938", Key: "operation_Id"},
							{Value: "GET /github/grafana/grafana/commits", Key: "operation_Name"},
							{
								Value: "|cfae497bfd7a44169f35643940820938.",
								Key:   "operation_ParentId",
							},
							{Value: "node:1.8.9", Key: "sdkVersion"},
							{Value: 1, Key: "severityLevel"},
							{Value: "2023-04-17T14:58:10.1760000Z", Key: "timestamp"},
						}),
					}),
					data.NewField("itemId", nil, []*string{
						util.Pointer("65863e6b-dd30-11ed-a808-002248268105"),
					}),
					data.NewField("itemType", nil, []*string{
						util.Pointer("trace"),
					}),
				)
				frame.Meta = &data.FrameMeta{
					Custom: &LogAnalyticsMeta{ColumnTypes: []string{"string", "string", "string", "real", "string", "string", "datetime", "dynamic", "dynamic", "string", "string"}},
				}
				return frame
			},
			resultFormat: dataquery.ResultFormatTrace,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := loadTestFileWithNumber(t, tt.testFile)
			frame, err := ResponseTableToFrame(&res.Tables[0], "A", "query", dataquery.AzureQueryTypeAzureTraces, tt.resultFormat)
			appendErrorNotice(frame, res.Error)
			require.NoError(t, err)
			if diff := cmp.Diff(tt.expectedFrame(), frame, data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func loadTestFileWithNumber(t *testing.T, name string) AzureLogAnalyticsResponse {
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
