package loganalytics

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/macros"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/utils"
	"k8s.io/utils/strings/slices"
)

type TraceQueries struct {
	TraceExploreQuery       string
	TraceParentExploreQuery string
	TraceLogsExploreQuery   string
}

func buildTracesQuery(operationId string, parentSpanID *string, traceTypes []string, filters []dataquery.AzureTracesFilter, resultFormat *dataquery.ResultFormat, resources []string) string {
	types := traceTypes
	if len(types) == 0 {
		types = Tables
	}

	filteredTypes := make([]string, 0)
	// If the result format is set to trace then we filter out all events that are of the type traces as they don't make sense when visualised as a span
	if resultFormat != nil && *resultFormat == dataquery.ResultFormatTrace {
		filteredTypes = slices.Filter(filteredTypes, types, func(s string) bool { return s != "traces" })
	} else {
		filteredTypes = types
	}
	sort.Strings(filteredTypes)

	if len(filteredTypes) == 0 {
		return ""
	}

	resourcesQuery := strings.Join(filteredTypes, ",")
	if len(resources) > 0 {
		intermediate := make([]string, 0)
		for _, resource := range resources {
			for _, table := range filteredTypes {
				intermediate = append(intermediate, fmt.Sprintf("app('%s').%s", resource, table))
			}
		}
		resourcesQuery += "," + strings.Join(intermediate, ",")
	}

	tagsMap := make(map[string]bool)
	var tags []string
	for _, t := range filteredTypes {
		tableTags := getTagsForTable(t)
		for _, i := range tableTags {
			if tagsMap[i] {
				continue
			}
			if i == "cloud_RoleInstance" || i == "cloud_RoleName" || i == "customDimensions" || i == "customMeasurements" {
				continue
			}
			tags = append(tags, i)
			tagsMap[i] = true
		}
	}
	sort.Strings(tags)

	whereClause := ""

	if operationId != "" {
		whereClause = fmt.Sprintf("| where (operation_Id != '' and operation_Id == '%s') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == '%s')", operationId, operationId)
	}

	parentWhereClause := ""
	if parentSpanID != nil && *parentSpanID != "" {
		parentWhereClause = fmt.Sprintf("| where (operation_ParentId != '' and operation_ParentId == '%s')", *parentSpanID)
	}

	filtersClause := ""

	if len(filters) > 0 {
		for _, filter := range filters {
			if len(filter.Filters) == 0 {
				continue
			}
			operation := "in"
			if filter.Operation == "ne" {
				operation = "!in"
			}
			filterValues := []string{}
			for _, val := range filter.Filters {
				filterValues = append(filterValues, fmt.Sprintf(`"%s"`, val))
			}
			filtersClause += fmt.Sprintf("| where %s %s (%s)", filter.Property, operation, strings.Join(filterValues, ","))
		}
	}

	propertiesFunc := "bag_merge(customDimensions, customMeasurements)"
	if len(tags) > 0 {
		propertiesFunc = fmt.Sprintf("bag_merge(bag_pack_columns(%s), customDimensions, customMeasurements)", strings.Join(tags, ","))
	}

	errorProperty := `| extend error = todynamic(iff(itemType == "exception", "true", "false"))`

	baseQuery := fmt.Sprintf(`set truncationmaxrecords=10000; set truncationmaxsize=67108864; union isfuzzy=true %s`, resourcesQuery)
	propertiesStaticQuery := `| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))` +
		`| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))` +
		`| extend operationName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))` +
		`| extend serviceName = cloud_RoleName` +
		`| extend serviceTags = bag_pack_columns(cloud_RoleInstance, cloud_RoleName)`
	propertiesQuery := fmt.Sprintf(`| extend tags = %s`, propertiesFunc)
	projectClause := `| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, resource = _ResourceId` +
		`| project startTime, itemType, serviceName, duration, traceID, spanID, parentSpanID, operationName, serviceTags, tags, itemId, resource` +
		`| order by startTime asc`
	return baseQuery + whereClause + parentWhereClause + propertiesStaticQuery + errorProperty + propertiesQuery + filtersClause + projectClause
}

func buildTracesLogsQuery(operationId string, resources []string) string {
	types := Tables
	sort.Strings(types)
	selectors := "union " + strings.Join(types, ",\n") + "\n"
	if len(resources) > 0 {
		intermediate := make([]string, 0)
		for _, resource := range resources {
			for _, table := range types {
				intermediate = append(intermediate, fmt.Sprintf("app('%s').%s", resource, table))
			}
		}
		sort.Strings(intermediate)
		types = intermediate
		selectors = strings.Join(append([]string{"union *"}, types...), ",\n") + "\n"
	}

	query := selectors
	query += fmt.Sprintf(`| where operation_Id == "%s"`, operationId)
	return query
}

func buildTraceQueries(query backend.DataQuery, dsInfo types.DatasourceInfo, tracesQuery dataquery.AzureTracesQuery, operationId string, resultFormat dataquery.ResultFormat, queryResources []string) (string, *TraceQueries, error) {
	traceExploreQuery := ""
	traceParentExploreQuery := ""
	traceLogsExploreQuery := ""
	traceIdVariable := "${__data.fields.traceID}"
	parentSpanIdVariable := "${__data.fields.parentSpanID}"
	var err error

	traceQueries := TraceQueries{}

	queryString := buildTracesQuery(operationId, nil, tracesQuery.TraceTypes, tracesQuery.Filters, &resultFormat, queryResources)

	if operationId == "" {
		traceExploreQuery = buildTracesQuery(traceIdVariable, nil, tracesQuery.TraceTypes, tracesQuery.Filters, &resultFormat, queryResources)
		traceParentExploreQuery = buildTracesQuery(traceIdVariable, &parentSpanIdVariable, tracesQuery.TraceTypes, tracesQuery.Filters, &resultFormat, queryResources)
		traceLogsExploreQuery = buildTracesLogsQuery(traceIdVariable, queryResources)
	} else {
		traceExploreQuery = queryString
		traceParentExploreQuery = buildTracesQuery(operationId, &parentSpanIdVariable, tracesQuery.TraceTypes, tracesQuery.Filters, &resultFormat, queryResources)
		traceLogsExploreQuery = buildTracesLogsQuery(operationId, queryResources)
	}

	traceExploreQuery, err = macros.KqlInterpolate(query, dsInfo, traceExploreQuery, "TimeGenerated")
	if err != nil {
		return "", &traceQueries, fmt.Errorf("failed to create traces explore query: %s", err)
	}
	traceQueries.TraceExploreQuery = traceExploreQuery

	traceParentExploreQuery, err = macros.KqlInterpolate(query, dsInfo, traceParentExploreQuery, "TimeGenerated")
	if err != nil {
		return "", &traceQueries, fmt.Errorf("failed to create parent span traces explore query: %s", err)
	}
	traceQueries.TraceParentExploreQuery = traceParentExploreQuery

	traceLogsExploreQuery, err = macros.KqlInterpolate(query, dsInfo, traceLogsExploreQuery, "TimeGenerated")
	if err != nil {
		return "", &traceQueries, fmt.Errorf("failed to create traces logs explore query: %s", err)
	}
	traceQueries.TraceLogsExploreQuery = traceLogsExploreQuery

	return queryString, &traceQueries, nil
}

func buildAppInsightsQuery(ctx context.Context, query backend.DataQuery, dsInfo types.DatasourceInfo, appInsightsRegExp *regexp.Regexp, logger log.Logger) (*AzureLogAnalyticsQuery, error) {
	dashboardTime := true
	timeColumn := ""
	queryJSONModel := types.TracesJSONQuery{}
	err := json.Unmarshal(query.JSON, &queryJSONModel)
	if err != nil {
		return nil, fmt.Errorf("failed to decode the Azure Traces query object from JSON: %w", err)
	}

	azureTracesTarget := queryJSONModel.AzureTraces

	resultFormat := ParseResultFormat(azureTracesTarget.ResultFormat, dataquery.AzureQueryTypeAzureTraces)

	resources := azureTracesTarget.Resources
	if query.QueryType == string(dataquery.AzureQueryTypeTraceExemplar) {
		subscription, err := utils.GetFirstSubscriptionOrDefault(ctx, dsInfo, logger)
		if err != nil {
			errorMessage := fmt.Errorf("failed to retrieve subscription for trace exemplars query: %w", err)
			return nil, utils.ApplySourceFromError(errorMessage, err)
		}
		resources = []string{fmt.Sprintf("/subscriptions/%s", subscription)}
	}

	resourceOrWorkspace := resources[0]
	appInsightsQuery := appInsightsRegExp.Match([]byte(resourceOrWorkspace))
	resourcesMap := make(map[string]bool, 0)
	if len(resources) > 1 {
		for _, resource := range resources {
			resourcesMap[strings.ToLower(resource)] = true
		}
		// Remove the base resource as that's where the query is run anyway
		delete(resourcesMap, strings.ToLower(resourceOrWorkspace))
	}

	operationId := ""
	if queryJSONModel.AzureTraces.OperationId != nil && *queryJSONModel.AzureTraces.OperationId != "" {
		operationId = *queryJSONModel.AzureTraces.OperationId
		resourcesMap, err = getCorrelationWorkspaces(ctx, resourceOrWorkspace, resourcesMap, dsInfo, operationId)
		if err != nil {
			errorMessage := fmt.Errorf("failed to retrieve correlation resources for operation ID - %s: %s", operationId, err)
			return nil, utils.ApplySourceFromError(errorMessage, err)
		}
	}

	queryResources := make([]string, 0)
	for resource := range resourcesMap {
		queryResources = append(queryResources, resource)
	}
	sort.Strings(queryResources)

	if query.QueryType == string(dataquery.AzureQueryTypeTraceExemplar) {
		resources = queryResources
		resourceOrWorkspace = resources[0]
	}

	queryString, traceQueries, err := buildTraceQueries(query, dsInfo, queryJSONModel.AzureTraces, operationId, resultFormat, queryResources)
	if err != nil {
		return nil, err
	}

	apiURL := getApiURL(resourceOrWorkspace, appInsightsQuery, false)

	rawQuery, err := macros.KqlInterpolate(query, dsInfo, queryString, "TimeGenerated")
	if err != nil {
		return nil, err
	}

	timeColumn = "timestamp"

	return &AzureLogAnalyticsQuery{
		RefID:                   query.RefID,
		ResultFormat:            resultFormat,
		URL:                     apiURL,
		JSON:                    query.JSON,
		TimeRange:               query.TimeRange,
		Query:                   rawQuery,
		Resources:               resources,
		QueryType:               dataquery.AzureQueryType(query.QueryType),
		TraceExploreQuery:       traceQueries.TraceExploreQuery,
		TraceParentExploreQuery: traceQueries.TraceParentExploreQuery,
		TraceLogsExploreQuery:   traceQueries.TraceLogsExploreQuery,
		AppInsightsQuery:        appInsightsQuery,
		DashboardTime:           dashboardTime,
		TimeColumn:              timeColumn,
	}, nil
}
