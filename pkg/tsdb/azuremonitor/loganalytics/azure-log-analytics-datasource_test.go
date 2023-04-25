package loganalytics

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

var logger = log.New("test")

func TestBuildingAzureLogAnalyticsQueries(t *testing.T) {
	datasource := &AzureLogAnalyticsDatasource{}
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
	timeRange := backend.TimeRange{From: fromStart, To: fromStart.Add(34 * time.Minute)}

	tests := []struct {
		name                     string
		queryModel               []backend.DataQuery
		azureLogAnalyticsQueries []*AzureLogAnalyticsQuery
		Err                      require.ErrorAssertionFunc
	}{
		{
			name: "Query with macros should be interpolated",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					RefID:     "A",
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: types.TimeSeries,
					URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					Query:     "Perf | where ['TimeGenerated'] >= datetime('2018-03-15T13:00:00Z') and ['TimeGenerated'] <= datetime('2018-03-15T13:34:00Z') | where ['Computer'] in ('comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, 34000ms), Computer",
					Resources: []string{"/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace"},
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
				},
			},
			Err: require.NoError,
		},

		{
			name: "Legacy queries with a workspace GUID should use workspace-centric url",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					RefID:     "A",
					QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: types.TimeSeries,
					URL:          "v1/workspaces/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					Query:     "Perf",
					Resources: []string{},
					QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
				},
			},
			Err: require.NoError,
		},

		{
			name: "Legacy workspace queries with a resource URI (from a template variable) should use resource-centric url",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					RefID:     "A",
					QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: types.TimeSeries,
					URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					Query:     "Perf",
					Resources: []string{},
					QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
				},
			},
			Err: require.NoError,
		},

		{
			name: "Queries with multiple resources",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					RefID:     "A",
					QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: types.TimeSeries,
					URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					Query:     "Perf",
					Resources: []string{"/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace"},
					QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
				},
			},
			Err: require.NoError,
		},
		{
			name: "Query with multiple resources",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/r1","/subscriptions/r2"],
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					RefID:     "A",
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: types.TimeSeries,
					URL:          "v1/subscriptions/r1/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/r1","/subscriptions/r2"],
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					Query:     "Perf",
					Resources: []string{"/subscriptions/r1", "/subscriptions/r2"},
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
				},
			},
			Err: require.NoError,
		},

		{
			name: "trace query",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
							"queryType": "Azure Traces",
							"azureTraces": {
								"resources":     ["/subscriptions/r1"],
								"resultFormat": "%s",
								"traceTypes":	["trace"],
								"operationId":	"test-op-id"
							}
						}`, dataquery.ResultFormatTable)),
					RefID:     "A",
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: string(dataquery.ResultFormatTable),
					URL:          "v1/subscriptions/r1/query",
					JSON: []byte(fmt.Sprintf(`{
							"queryType": "Azure Traces",
							"azureTraces": {
								"resources":     ["/subscriptions/r1"],
								"resultFormat": "%s",
								"traceTypes":	["trace"],
								"operationId":	"test-op-id"
							}
						}`, dataquery.ResultFormatTable)),
					Query: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true trace | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')` + `| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns()| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
					Resources: []string{"/subscriptions/r1"},
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
					TraceExploreQuery: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true trace | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns()| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
				},
			},
			Err: require.NoError,
		},
		{
			name: "trace query with no result format set",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(`{
							"queryType": "Azure Traces",
							"azureTraces": {
								"resources":     ["/subscriptions/r1"],
								"traceTypes":	["trace"],
								"operationId":	"test-op-id"
							}
						}`),
					RefID:     "A",
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: string(dataquery.ResultFormatTable),
					URL:          "v1/subscriptions/r1/query",
					JSON: []byte(`{
							"queryType": "Azure Traces",
							"azureTraces": {
								"resources":     ["/subscriptions/r1"],
								"traceTypes":	["trace"],
								"operationId":	"test-op-id"
							}
						}`),
					Query: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true trace | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns()| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
					Resources: []string{"/subscriptions/r1"},
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
					TraceExploreQuery: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true trace | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns()| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
				},
			},
			Err: require.NoError,
		},
		{
			name: "trace query with no operation ID",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
							"queryType": "Azure Traces",
							"azureTraces": {
								"resources":     ["/subscriptions/r1"],
								"resultFormat": "%s"
							}
						}`, dataquery.ResultFormatTable)),
					RefID:     "A",
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: string(dataquery.ResultFormatTable),
					URL:          "v1/subscriptions/r1/query",
					JSON: []byte(fmt.Sprintf(`{
							"queryType": "Azure Traces",
							"azureTraces": {
								"resources":     ["/subscriptions/r1"],
								"resultFormat": "%s"
							}
						}`, dataquery.ResultFormatTable)),
					Query: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true availabilityResults,customEvents,dependencies,exceptions,pageViews,requests,traces | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns(appId,appName,application_Version,assembly,client_Browser,client_City,client_CountryOrRegion,client_IP,client_Model,client_OS,client_StateOrProvince,client_Type,cloud_RoleInstance,cloud_RoleName,customDimensions,customMeasurements,data,details,duration,handledAt,iKey,id,innermostAssembly,innermostMessage,innermostMethod,innermostType,itemCount,itemId,itemType,location,message,method,name,operation_Id,operation_Name,operation_ParentId,operation_SyntheticSource,outerAssembly,outerMessage,outerMethod,outerType,performanceBucket,problemId,resultCode,sdkVersion,session_Id,severityLevel,size,source,success,target,timestamp,type,url,user_AccountId,user_AuthenticatedId,user_Id)| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
					Resources: []string{"/subscriptions/r1"},
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
					TraceExploreQuery: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true availabilityResults,customEvents,dependencies,exceptions,pageViews,requests,traces | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == '${__data.fields.traceID}') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == '${__data.fields.traceID}')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns(appId,appName,application_Version,assembly,client_Browser,client_City,client_CountryOrRegion,client_IP,client_Model,client_OS,client_StateOrProvince,client_Type,cloud_RoleInstance,cloud_RoleName,customDimensions,customMeasurements,data,details,duration,handledAt,iKey,id,innermostAssembly,innermostMessage,innermostMethod,innermostType,itemCount,itemId,itemType,location,message,method,name,operation_Id,operation_Name,operation_ParentId,operation_SyntheticSource,outerAssembly,outerMessage,outerMethod,outerType,performanceBucket,problemId,resultCode,sdkVersion,session_Id,severityLevel,size,source,success,target,timestamp,type,url,user_AccountId,user_AuthenticatedId,user_Id)| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
				},
			},
			Err: require.NoError,
		},
		{
			name: "trace query with no types",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
							"queryType": "Azure Traces",
							"azureTraces": {
								"resources":     ["/subscriptions/r1"],
								"resultFormat": "%s",
								"operationId":	"test-op-id"
							}
						}`, dataquery.ResultFormatTable)),
					RefID:     "A",
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: string(dataquery.ResultFormatTable),
					URL:          "v1/subscriptions/r1/query",
					JSON: []byte(fmt.Sprintf(`{
							"queryType": "Azure Traces",
							"azureTraces": {
								"resources":     ["/subscriptions/r1"],
								"resultFormat": "%s",
								"operationId":	"test-op-id"
							}
						}`, dataquery.ResultFormatTable)),
					Query: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true availabilityResults,customEvents,dependencies,exceptions,pageViews,requests,traces | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns(appId,appName,application_Version,assembly,client_Browser,client_City,client_CountryOrRegion,client_IP,client_Model,client_OS,client_StateOrProvince,client_Type,cloud_RoleInstance,cloud_RoleName,customDimensions,customMeasurements,data,details,duration,handledAt,iKey,id,innermostAssembly,innermostMessage,innermostMethod,innermostType,itemCount,itemId,itemType,location,message,method,name,operation_Id,operation_Name,operation_ParentId,operation_SyntheticSource,outerAssembly,outerMessage,outerMethod,outerType,performanceBucket,problemId,resultCode,sdkVersion,session_Id,severityLevel,size,source,success,target,timestamp,type,url,user_AccountId,user_AuthenticatedId,user_Id)` +
						`| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
					Resources: []string{"/subscriptions/r1"},
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
					TraceExploreQuery: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true availabilityResults,customEvents,dependencies,exceptions,pageViews,requests,traces | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns(appId,appName,application_Version,assembly,client_Browser,client_City,client_CountryOrRegion,client_IP,client_Model,client_OS,client_StateOrProvince,client_Type,cloud_RoleInstance,cloud_RoleName,customDimensions,customMeasurements,data,details,duration,handledAt,iKey,id,innermostAssembly,innermostMessage,innermostMethod,innermostType,itemCount,itemId,itemType,location,message,method,name,operation_Id,operation_Name,operation_ParentId,operation_SyntheticSource,outerAssembly,outerMessage,outerMethod,outerType,performanceBucket,problemId,resultCode,sdkVersion,session_Id,severityLevel,size,source,success,target,timestamp,type,url,user_AccountId,user_AuthenticatedId,user_Id)` +
						`| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
				},
			},
			Err: require.NoError,
		},
		{
			name: "trace query with eq filter",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
								"queryType": "Azure Traces",
								"azureTraces": {
									"resources":     ["/subscriptions/r1"],
									"resultFormat": "%s",
									"operationId":	"test-op-id",
									"filters":		[{"filters": ["test-app-id"], "property": "appId", "operation": "eq"}]
								}
							}`, dataquery.ResultFormatTable)),
					RefID:     "A",
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: string(dataquery.ResultFormatTable),
					URL:          "v1/subscriptions/r1/query",
					JSON: []byte(fmt.Sprintf(`{
								"queryType": "Azure Traces",
								"azureTraces": {
									"resources":     ["/subscriptions/r1"],
									"resultFormat": "%s",
									"operationId":	"test-op-id",
									"filters":		[{"filters": ["test-app-id"], "property": "appId", "operation": "eq"}]
								}
							}`, dataquery.ResultFormatTable)),
					Query: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true availabilityResults,customEvents,dependencies,exceptions,pageViews,requests,traces | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns(appId,appName,application_Version,assembly,client_Browser,client_City,client_CountryOrRegion,client_IP,client_Model,client_OS,client_StateOrProvince,client_Type,cloud_RoleInstance,cloud_RoleName,customDimensions,customMeasurements,data,details,duration,handledAt,iKey,id,innermostAssembly,innermostMessage,innermostMethod,innermostType,itemCount,itemId,itemType,location,message,method,name,operation_Id,operation_Name,operation_ParentId,operation_SyntheticSource,outerAssembly,outerMessage,outerMethod,outerType,performanceBucket,problemId,resultCode,sdkVersion,session_Id,severityLevel,size,source,success,target,timestamp,type,url,user_AccountId,user_AuthenticatedId,user_Id)` +
						`| where appId in ("test-app-id")` +
						`| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
					Resources: []string{"/subscriptions/r1"},
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
					TraceExploreQuery: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true availabilityResults,customEvents,dependencies,exceptions,pageViews,requests,traces | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns(appId,appName,application_Version,assembly,client_Browser,client_City,client_CountryOrRegion,client_IP,client_Model,client_OS,client_StateOrProvince,client_Type,cloud_RoleInstance,cloud_RoleName,customDimensions,customMeasurements,data,details,duration,handledAt,iKey,id,innermostAssembly,innermostMessage,innermostMethod,innermostType,itemCount,itemId,itemType,location,message,method,name,operation_Id,operation_Name,operation_ParentId,operation_SyntheticSource,outerAssembly,outerMessage,outerMethod,outerType,performanceBucket,problemId,resultCode,sdkVersion,session_Id,severityLevel,size,source,success,target,timestamp,type,url,user_AccountId,user_AuthenticatedId,user_Id)` +
						`| where appId in ("test-app-id")` +
						`| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
				},
			},
			Err: require.NoError,
		},
		{
			name: "trace query with ne filter",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
								"queryType": "Azure Traces",
								"azureTraces": {
									"resources":     ["/subscriptions/r1"],
									"resultFormat": "%s",
									"operationId":	"test-op-id",
									"filters":		[{"filters": ["test-app-id"], "property": "appId", "operation": "ne"}]
								}
							}`, dataquery.ResultFormatTable)),
					RefID:     "A",
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: string(dataquery.ResultFormatTable),
					URL:          "v1/subscriptions/r1/query",
					JSON: []byte(fmt.Sprintf(`{
								"queryType": "Azure Traces",
								"azureTraces": {
									"resources":     ["/subscriptions/r1"],
									"resultFormat": "%s",
									"operationId":	"test-op-id",
									"filters":		[{"filters": ["test-app-id"], "property": "appId", "operation": "ne"}]
								}
							}`, dataquery.ResultFormatTable)),
					Query: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true availabilityResults,customEvents,dependencies,exceptions,pageViews,requests,traces | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns(appId,appName,application_Version,assembly,client_Browser,client_City,client_CountryOrRegion,client_IP,client_Model,client_OS,client_StateOrProvince,client_Type,cloud_RoleInstance,cloud_RoleName,customDimensions,customMeasurements,data,details,duration,handledAt,iKey,id,innermostAssembly,innermostMessage,innermostMethod,innermostType,itemCount,itemId,itemType,location,message,method,name,operation_Id,operation_Name,operation_ParentId,operation_SyntheticSource,outerAssembly,outerMessage,outerMethod,outerType,performanceBucket,problemId,resultCode,sdkVersion,session_Id,severityLevel,size,source,success,target,timestamp,type,url,user_AccountId,user_AuthenticatedId,user_Id)` +
						`| where appId !in ("test-app-id")` +
						`| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
					Resources: []string{"/subscriptions/r1"},
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
					TraceExploreQuery: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true availabilityResults,customEvents,dependencies,exceptions,pageViews,requests,traces | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns(appId,appName,application_Version,assembly,client_Browser,client_City,client_CountryOrRegion,client_IP,client_Model,client_OS,client_StateOrProvince,client_Type,cloud_RoleInstance,cloud_RoleName,customDimensions,customMeasurements,data,details,duration,handledAt,iKey,id,innermostAssembly,innermostMessage,innermostMethod,innermostType,itemCount,itemId,itemType,location,message,method,name,operation_Id,operation_Name,operation_ParentId,operation_SyntheticSource,outerAssembly,outerMessage,outerMethod,outerType,performanceBucket,problemId,resultCode,sdkVersion,session_Id,severityLevel,size,source,success,target,timestamp,type,url,user_AccountId,user_AuthenticatedId,user_Id)` +
						`| where appId !in ("test-app-id")` +
						`| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
				},
			},
			Err: require.NoError,
		},
		{
			name: "trace query with multiple filters",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
								"queryType": "Azure Traces",
								"azureTraces": {
									"resources":     ["/subscriptions/r1"],
									"resultFormat": "%s",
									"operationId":	"test-op-id",
									"filters":		[{"filters": ["test-app-id"], "property": "appId", "operation": "ne"},{"filters": ["test-client-id"], "property": "clientId", "operation": "eq"}]
							}
						}`, dataquery.ResultFormatTable)),
					RefID:     "A",
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: string(dataquery.ResultFormatTable),
					URL:          "v1/subscriptions/r1/query",
					JSON: []byte(fmt.Sprintf(`{
								"queryType": "Azure Traces",
								"azureTraces": {
									"resources":     ["/subscriptions/r1"],
									"resultFormat": "%s",
									"operationId":	"test-op-id",
									"filters":		[{"filters": ["test-app-id"], "property": "appId", "operation": "ne"},{"filters": ["test-client-id"], "property": "clientId", "operation": "eq"}]
							}
						}`, dataquery.ResultFormatTable)),
					Query: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true availabilityResults,customEvents,dependencies,exceptions,pageViews,requests,traces | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns(appId,appName,application_Version,assembly,client_Browser,client_City,client_CountryOrRegion,client_IP,client_Model,client_OS,client_StateOrProvince,client_Type,cloud_RoleInstance,cloud_RoleName,customDimensions,customMeasurements,data,details,duration,handledAt,iKey,id,innermostAssembly,innermostMessage,innermostMethod,innermostType,itemCount,itemId,itemType,location,message,method,name,operation_Id,operation_Name,operation_ParentId,operation_SyntheticSource,outerAssembly,outerMessage,outerMethod,outerType,performanceBucket,problemId,resultCode,sdkVersion,session_Id,severityLevel,size,source,success,target,timestamp,type,url,user_AccountId,user_AuthenticatedId,user_Id)` +
						`| where appId !in ("test-app-id")| where clientId in ("test-client-id")` +
						`| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
					Resources: []string{"/subscriptions/r1"},
					TimeRange: timeRange,
					QueryType: string(dataquery.AzureQueryTypeAzureTraces),
					TraceExploreQuery: `set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true availabilityResults,customEvents,dependencies,exceptions,pageViews,requests,traces | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z')` +
						`| where (operation_Id != '' and operation_Id == 'test-op-id') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == 'test-op-id')| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
						`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
						`| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
						`| extend tags = bag_pack_columns(appId,appName,application_Version,assembly,client_Browser,client_City,client_CountryOrRegion,client_IP,client_Model,client_OS,client_StateOrProvince,client_Type,cloud_RoleInstance,cloud_RoleName,customDimensions,customMeasurements,data,details,duration,handledAt,iKey,id,innermostAssembly,innermostMessage,innermostMethod,innermostType,itemCount,itemId,itemType,location,message,method,name,operation_Id,operation_Name,operation_ParentId,operation_SyntheticSource,outerAssembly,outerMessage,outerMethod,outerType,performanceBucket,problemId,resultCode,sdkVersion,session_Id,severityLevel,size,source,success,target,timestamp,type,url,user_AccountId,user_AuthenticatedId,user_Id)` +
						`| where appId !in ("test-app-id")| where clientId in ("test-client-id")` +
						`| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name` +
						`| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType` +
						`| order by startTime asc`,
				},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			queries, err := datasource.buildQueries(logger, tt.queryModel, types.DatasourceInfo{})
			tt.Err(t, err)
			if diff := cmp.Diff(tt.azureLogAnalyticsQueries[0], queries[0]); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestLogAnalyticsCreateRequest(t *testing.T) {
	ctx := context.Background()
	url := "http://ds/"

	t.Run("creates a request", func(t *testing.T) {
		ds := AzureLogAnalyticsDatasource{}
		req, err := ds.createRequest(ctx, logger, url, &AzureLogAnalyticsQuery{
			Resources: []string{"r"},
			Query:     "Perf",
		})
		require.NoError(t, err)
		if req.URL.String() != url {
			t.Errorf("Expecting %s, got %s", url, req.URL.String())
		}
		expectedHeaders := http.Header{"Content-Type": []string{"application/json"}}
		if !cmp.Equal(req.Header, expectedHeaders) {
			t.Errorf("Unexpected HTTP headers: %v", cmp.Diff(req.Header, expectedHeaders))
		}
		expectedBody := `{"query":"Perf"}`
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		if !cmp.Equal(string(body), expectedBody) {
			t.Errorf("Unexpected Body: %v", cmp.Diff(string(body), expectedBody))
		}
	})

	t.Run("creates a request with multiple resources", func(t *testing.T) {
		ds := AzureLogAnalyticsDatasource{}
		req, err := ds.createRequest(ctx, logger, url, &AzureLogAnalyticsQuery{
			Resources: []string{"r1", "r2"},
			Query:     "Perf",
		})
		require.NoError(t, err)
		expectedBody := `{"query":"Perf","resources":["r1","r2"]}`
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		if !cmp.Equal(string(body), expectedBody) {
			t.Errorf("Unexpected Body: %v", cmp.Diff(string(body), expectedBody))
		}
	})
}

func Test_executeQueryErrorWithDifferentLogAnalyticsCreds(t *testing.T) {
	ds := AzureLogAnalyticsDatasource{}
	dsInfo := types.DatasourceInfo{
		Services: map[string]types.DatasourceService{
			"Azure Log Analytics": {URL: "http://ds"},
		},
		JSONData: map[string]interface{}{
			"azureLogAnalyticsSameAs": false,
		},
	}
	ctx := context.Background()
	query := &AzureLogAnalyticsQuery{
		TimeRange: backend.TimeRange{},
	}
	tracer := tracing.InitializeTracerForTest()
	res := ds.executeQuery(ctx, logger, query, dsInfo, &http.Client{}, dsInfo.Services["Azure Log Analytics"].URL, tracer)
	if res.Error == nil {
		t.Fatal("expecting an error")
	}
	if !strings.Contains(res.Error.Error(), "credentials for Log Analytics are no longer supported") {
		t.Error("expecting the error to inform of bad credentials")
	}
}
