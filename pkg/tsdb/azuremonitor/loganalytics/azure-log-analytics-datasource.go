package loganalytics

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/macros"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// AzureLogAnalyticsDatasource calls the Azure Log Analytics API's
type AzureLogAnalyticsDatasource struct {
	Proxy types.ServiceProxy
}

// AzureLogAnalyticsQuery is the query request that is built from the saved values for
// from the UI
type AzureLogAnalyticsQuery struct {
	RefID             string
	ResultFormat      string
	URL               string
	TraceExploreQuery string
	JSON              json.RawMessage
	TimeRange         backend.TimeRange
	Query             string
	Resources         []string
	QueryType         string
}

func (e *AzureLogAnalyticsDatasource) ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) {
	e.Proxy.Do(rw, req, cli)
}

// executeTimeSeriesQuery does the following:
// 1. build the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into data frames
func (e *AzureLogAnalyticsDatasource) ExecuteTimeSeriesQuery(ctx context.Context, logger log.Logger, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, url string, tracer tracing.Tracer) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()
	ctxLogger := logger.FromContext(ctx)
	queries, err := e.buildQueries(ctxLogger, originalQueries, dsInfo)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		result.Responses[query.RefID] = e.executeQuery(ctx, ctxLogger, query, dsInfo, client, url, tracer)
	}

	return result, nil
}

func getApiURL(resourceOrWorkspace string) string {
	matchesResourceURI, _ := regexp.MatchString("^/subscriptions/", resourceOrWorkspace)

	if matchesResourceURI {
		return fmt.Sprintf("v1%s/query", resourceOrWorkspace)
	} else {
		return fmt.Sprintf("v1/workspaces/%s/query", resourceOrWorkspace)
	}
}

func (e *AzureLogAnalyticsDatasource) buildQueries(logger log.Logger, queries []backend.DataQuery, dsInfo types.DatasourceInfo) ([]*AzureLogAnalyticsQuery, error) {
	azureLogAnalyticsQueries := []*AzureLogAnalyticsQuery{}

	for _, query := range queries {
		resources := []string{}
		var resourceOrWorkspace string
		var queryString string
		var resultFormat string
		traceExploreQuery := ""
		if query.QueryType == string(dataquery.AzureQueryTypeAzureLogAnalytics) {
			queryJSONModel := types.LogJSONQuery{}
			err := json.Unmarshal(query.JSON, &queryJSONModel)
			if err != nil {
				return nil, fmt.Errorf("failed to decode the Azure Log Analytics query object from JSON: %w", err)
			}

			azureLogAnalyticsTarget := queryJSONModel.AzureLogAnalytics
			logger.Debug("AzureLogAnalytics", "target", azureLogAnalyticsTarget)

			resultFormat = azureLogAnalyticsTarget.ResultFormat
			if resultFormat == "" {
				resultFormat = types.TimeSeries
			}

			// Legacy queries only specify a Workspace GUID, which we need to use the old workspace-centric
			// API URL for, and newer queries specifying a resource URI should use resource-centric API.
			// However, legacy workspace queries using a `workspaces()` template variable will be resolved
			// to a resource URI, so they should use the new resource-centric.
			if len(azureLogAnalyticsTarget.Resources) > 0 {
				resources = azureLogAnalyticsTarget.Resources
				resourceOrWorkspace = azureLogAnalyticsTarget.Resources[0]
			} else if azureLogAnalyticsTarget.Resource != "" {
				resources = []string{azureLogAnalyticsTarget.Resource}
				resourceOrWorkspace = azureLogAnalyticsTarget.Resource
			} else {
				resourceOrWorkspace = azureLogAnalyticsTarget.Workspace
			}

			queryString = azureLogAnalyticsTarget.Query
		}

		if query.QueryType == string(dataquery.AzureQueryTypeAzureTraces) {
			queryJSONModel := types.TracesJSONQuery{}
			err := json.Unmarshal(query.JSON, &queryJSONModel)
			if err != nil {
				return nil, fmt.Errorf("failed to decode the Azure Traces query object from JSON: %w", err)
			}

			azureTracesTarget := queryJSONModel.AzureTraces
			logger.Debug("AzureTraces", "target", azureTracesTarget)

			if azureTracesTarget.ResultFormat == nil {
				resultFormat = types.Table
			} else {
				resultFormat = string(*azureTracesTarget.ResultFormat)
				if resultFormat == "" {
					resultFormat = types.Table
				}
			}

			resources = azureTracesTarget.Resources
			resourceOrWorkspace = azureTracesTarget.Resources[0]

			queryString = buildTracesQuery(queryJSONModel.AzureTraces.OperationId, queryJSONModel.AzureTraces.TraceTypes, queryJSONModel.AzureTraces.Filters)
			traceIdVariable := "${__data.fields.traceID}"
			if queryJSONModel.AzureTraces.OperationId == nil {
				traceExploreQuery = buildTracesQuery(&traceIdVariable, queryJSONModel.AzureTraces.TraceTypes, queryJSONModel.AzureTraces.Filters)
			} else {
				traceExploreQuery = queryString
			}
			traceExploreQuery, err = macros.KqlInterpolate(logger, query, dsInfo, traceExploreQuery, "TimeGenerated")
			if err != nil {
				return nil, fmt.Errorf("failed to create traces explore query: %s", err)
			}
		}

		apiURL := getApiURL(resourceOrWorkspace)

		rawQuery, err := macros.KqlInterpolate(logger, query, dsInfo, queryString, "TimeGenerated")
		if err != nil {
			return nil, err
		}

		azureLogAnalyticsQueries = append(azureLogAnalyticsQueries, &AzureLogAnalyticsQuery{
			RefID:             query.RefID,
			ResultFormat:      resultFormat,
			URL:               apiURL,
			JSON:              query.JSON,
			TimeRange:         query.TimeRange,
			Query:             rawQuery,
			Resources:         resources,
			QueryType:         query.QueryType,
			TraceExploreQuery: traceExploreQuery,
		})
	}

	return azureLogAnalyticsQueries, nil
}

func (e *AzureLogAnalyticsDatasource) executeQuery(ctx context.Context, logger log.Logger, query *AzureLogAnalyticsQuery, dsInfo types.DatasourceInfo, client *http.Client,
	url string, tracer tracing.Tracer) backend.DataResponse {
	dataResponse := backend.DataResponse{}

	dataResponseErrorWithExecuted := func(err error) backend.DataResponse {
		dataResponse.Error = err
		dataResponse.Frames = data.Frames{
			&data.Frame{
				RefID: query.RefID,
				Meta: &data.FrameMeta{
					ExecutedQueryString: query.Query,
				},
			},
		}
		return dataResponse
	}

	// If azureLogAnalyticsSameAs is defined and set to false, return an error
	if sameAs, ok := dsInfo.JSONData["azureLogAnalyticsSameAs"]; ok && !sameAs.(bool) {
		return dataResponseErrorWithExecuted(fmt.Errorf("credentials for Log Analytics are no longer supported. Go to the data source configuration to update Azure Monitor credentials"))
	}

	queryJSONModel := dataquery.AzureMonitorQuery{}
	err := json.Unmarshal(query.JSON, &queryJSONModel)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	if query.QueryType == string(dataquery.AzureQueryTypeAzureTraces) && *queryJSONModel.AzureTraces.OperationId != "" {
		query, err = getCorrelationWorkspaces(ctx, logger, query, dsInfo, *queryJSONModel.AzureTraces.OperationId, tracer)
		if err != nil {
			dataResponse.Error = err
			return dataResponse
		}
	}

	req, err := e.createRequest(ctx, logger, url, query)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	ctx, span := tracer.Start(ctx, "azure log analytics query")
	span.SetAttributes("target", query.Query, attribute.Key("target").String(query.Query))
	span.SetAttributes("from", query.TimeRange.From.UnixNano()/int64(time.Millisecond), attribute.Key("from").Int64(query.TimeRange.From.UnixNano()/int64(time.Millisecond)))
	span.SetAttributes("until", query.TimeRange.To.UnixNano()/int64(time.Millisecond), attribute.Key("until").Int64(query.TimeRange.To.UnixNano()/int64(time.Millisecond)))
	span.SetAttributes("datasource_id", dsInfo.DatasourceID, attribute.Key("datasource_id").Int64(dsInfo.DatasourceID))
	span.SetAttributes("org_id", dsInfo.OrgID, attribute.Key("org_id").Int64(dsInfo.OrgID))

	defer span.End()

	tracer.Inject(ctx, req.Header, span)

	logger.Debug("AzureLogAnalytics", "Request ApiURL", req.URL.String())
	res, err := client.Do(req)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	defer func() {
		err := res.Body.Close()
		if err != nil {
			logger.Warn("failed to close response body", "error", err)
		}
	}()

	logResponse, err := e.unmarshalResponse(logger, res)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	t, err := logResponse.GetPrimaryResultTable()
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	frame, err := ResponseTableToFrame(t, query.RefID, query.Query, dataquery.AzureQueryType(query.QueryType), dataquery.ResultFormat(query.ResultFormat))
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}
	frame = appendErrorNotice(frame, logResponse.Error)
	if frame == nil {
		return dataResponse
	}

	azurePortalBaseUrl, err := GetAzurePortalUrl(dsInfo.Cloud)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	if query.QueryType == string(dataquery.AzureQueryTypeAzureTraces) && query.ResultFormat == string(dataquery.ResultFormatTrace) {
		frame.Meta.PreferredVisualization = "trace"
	}

	if query.ResultFormat == string(dataquery.ResultFormatTable) {
		frame.Meta.PreferredVisualization = "table"
	}

	if query.ResultFormat == types.TimeSeries {
		tsSchema := frame.TimeSeriesSchema()
		if tsSchema.Type == data.TimeSeriesTypeLong {
			wideFrame, err := data.LongToWide(frame, nil)
			if err == nil {
				frame = wideFrame
			} else {
				frame.AppendNotices(data.Notice{Severity: data.NoticeSeverityWarning, Text: "could not convert frame to time series, returning raw table: " + err.Error()})
			}
		}
	}

	queryUrl, err := getQueryUrl(query.Query, query.Resources, azurePortalBaseUrl)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}
	AddConfigLinks(*frame, queryUrl, nil)

	if query.QueryType == string(dataquery.AzureQueryTypeAzureTraces) {
		tracesUrl, err := getTracesQueryUrl(query.Resources, azurePortalBaseUrl)
		if err != nil {
			dataResponse.Error = err
			return dataResponse
		}
		linkTitle := "View E2E transaction in Application Insights"
		AddConfigLinks(*frame, tracesUrl, &linkTitle)

		if query.TraceExploreQuery != "" {
			queryJSONModel := dataquery.AzureMonitorQuery{}
			err = json.Unmarshal(query.JSON, &queryJSONModel)
			if err != nil {
				dataResponse.Error = err
				return dataResponse
			}
			traceIdVariable := "${__data.fields.traceID}"
			resultFormat := dataquery.AzureMonitorQueryAzureTracesResultFormatTrace
			queryJSONModel.AzureTraces.ResultFormat = &resultFormat
			queryJSONModel.AzureTraces.Query = &query.TraceExploreQuery
			if queryJSONModel.AzureTraces.OperationId == nil || *queryJSONModel.AzureTraces.OperationId == "" {
				queryJSONModel.AzureTraces.OperationId = &traceIdVariable
			}
			AddCustomDataLink(*frame, data.DataLink{
				Title: "Explore Trace: ${__data.fields.traceID}",
				URL:   "",
				Internal: &data.InternalDataLink{
					DatasourceUID:  dsInfo.DatasourceUID,
					DatasourceName: dsInfo.DatasourceName,
					Query:          queryJSONModel,
				},
			})
		}
	}

	dataResponse.Frames = data.Frames{frame}
	return dataResponse
}

func appendErrorNotice(frame *data.Frame, err *AzureLogAnalyticsAPIError) *data.Frame {
	if err == nil {
		return frame
	}
	if frame == nil {
		frame = &data.Frame{}
	}
	frame.AppendNotices(apiErrorToNotice(err))
	return frame
}

func (e *AzureLogAnalyticsDatasource) createRequest(ctx context.Context, logger log.Logger, queryURL string, query *AzureLogAnalyticsQuery) (*http.Request, error) {
	body := map[string]interface{}{
		"query": query.Query,
	}
	if len(query.Resources) > 1 {
		body["resources"] = query.Resources
	}
	jsonValue, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to create request", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, queryURL, bytes.NewBuffer(jsonValue))
	if err != nil {
		logger.Debug("Failed to create request", "error", err)
		return nil, fmt.Errorf("%v: %w", "failed to create request", err)
	}
	req.URL.Path = "/"
	req.Header.Set("Content-Type", "application/json")
	req.URL.Path = path.Join(req.URL.Path, query.URL)

	return req, nil
}

type AzureLogAnalyticsURLResources struct {
	Resources []AzureLogAnalyticsURLResource `json:"resources"`
}

type AzureLogAnalyticsURLResource struct {
	ResourceID string `json:"resourceId"`
}

func getQueryUrl(query string, resources []string, azurePortalUrl string) (string, error) {
	encodedQuery, err := encodeQuery(query)
	if err != nil {
		return "", fmt.Errorf("failed to encode the query: %s", err)
	}

	portalUrl := azurePortalUrl
	if err != nil {
		return "", fmt.Errorf("failed to parse base portal URL: %s", err)
	}

	portalUrl += "/#blade/Microsoft_OperationsManagementSuite_Workspace/AnalyticsBlade/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope/"
	resourcesJson := AzureLogAnalyticsURLResources{
		Resources: make([]AzureLogAnalyticsURLResource, 0),
	}
	for _, resource := range resources {
		resourcesJson.Resources = append(resourcesJson.Resources, AzureLogAnalyticsURLResource{
			ResourceID: resource,
		})
	}
	resourcesMarshalled, err := json.Marshal(resourcesJson)
	if err != nil {
		return "", fmt.Errorf("failed to marshal log analytics resources: %s", err)
	}
	portalUrl += url.QueryEscape(string(resourcesMarshalled))
	portalUrl += "/query/" + url.PathEscape(encodedQuery) + "/isQueryBase64Compressed/true/timespanInIsoFormat/P1D"
	return portalUrl, nil
}

func getTracesQueryUrl(resources []string, azurePortalUrl string) (string, error) {
	portalUrl := azurePortalUrl
	portalUrl += "/#view/AppInsightsExtension/DetailsV2Blade/ComponentId~/"
	resource := struct {
		ResourceId string `json:"ResourceId"`
	}{
		resources[0],
	}
	resourceMarshalled, err := json.Marshal(resource)
	if err != nil {
		return "", fmt.Errorf("failed to marshal application insights resource: %s", err)
	}

	portalUrl += url.PathEscape(string(resourceMarshalled))
	portalUrl += "/DataModel~/"

	// We're making use of data link variables to select the necessary fields in the frontend
	eventId := "%22eventId%22%3A%22${__data.fields.itemId}%22%2C"
	timestamp := "%22timestamp%22%3A%22${__data.fields.startTime}%22%2C"
	eventTable := "%22eventTable%22%3A%22${__data.fields.itemType}%22"
	traceObject := fmt.Sprintf("%%7B%s%s%s%%7D", eventId, timestamp, eventTable)

	portalUrl += traceObject

	return portalUrl, nil
}

func getCorrelationWorkspaces(ctx context.Context, logger log.Logger, query *AzureLogAnalyticsQuery, dsInfo types.DatasourceInfo, operationId string, tracer tracing.Tracer) (*AzureLogAnalyticsQuery, error) {
	azMonService := dsInfo.Services["Azure Monitor"]
	correlationUrl := azMonService.URL + fmt.Sprintf("%s/providers/microsoft.insights/transactions/%s", query.Resources[0], operationId)

	callCorrelationAPI := func(url string) (AzureCorrelationAPIResponse, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer([]byte{}))
		if err != nil {
			logger.Debug("Failed to create request", "error", err)
			return AzureCorrelationAPIResponse{}, fmt.Errorf("%v: %w", "failed to create request", err)
		}
		req.URL.Path = url
		req.Header.Set("Content-Type", "application/json")
		values := req.URL.Query()
		values.Add("api-version", "2019-10-17-preview")
		req.URL.RawQuery = values.Encode()
		req.Method = "GET"

		ctx, span := tracer.Start(ctx, "azure traces correlation request")
		span.SetAttributes("target", req.URL, attribute.Key("target").String(req.URL.String()))
		span.SetAttributes("datasource_id", dsInfo.DatasourceID, attribute.Key("datasource_id").Int64(dsInfo.DatasourceID))
		span.SetAttributes("org_id", dsInfo.OrgID, attribute.Key("org_id").Int64(dsInfo.OrgID))

		defer span.End()

		tracer.Inject(ctx, req.Header, span)

		logger.Debug("AzureLogAnalytics", "Traces Correlation ApiURL", req.URL.String())
		res, err := azMonService.HTTPClient.Do(req)
		if err != nil {
			return AzureCorrelationAPIResponse{}, err
		}
		body, err := io.ReadAll(res.Body)
		if err != nil {
			return AzureCorrelationAPIResponse{}, err
		}
		defer func() {
			err := res.Body.Close()
			if err != nil {
				logger.Warn("failed to close response body", "error", err)
			}
		}()

		if res.StatusCode/100 != 2 {
			logger.Debug("Request failed", "status", res.Status, "body", string(body))
			return AzureCorrelationAPIResponse{}, fmt.Errorf("request failed, status: %s, body: %s", res.Status, string(body))
		}
		var data AzureCorrelationAPIResponse
		d := json.NewDecoder(bytes.NewReader(body))
		d.UseNumber()
		err = d.Decode(&data)
		if err != nil {
			logger.Debug("Failed to unmarshal Azure Traces correlation API response", "error", err, "status", res.Status, "body", string(body))
			return AzureCorrelationAPIResponse{}, err
		}

		return data, nil
	}

	var nextLink *string
	var correlationResponse AzureCorrelationAPIResponse

	correlationResponse, err := callCorrelationAPI(correlationUrl)
	if err != nil {
		return query, err
	}
	nextLink = correlationResponse.Properties.NextLink
	query.Resources = correlationResponse.Properties.Resources

	for nextLink != nil {
		correlationResponse, err := callCorrelationAPI(correlationUrl)
		if err != nil {
			return query, err
		}
		query.Resources = append(query.Resources, correlationResponse.Properties.Resources...)
		nextLink = correlationResponse.Properties.NextLink
	}

	return query, nil
}

// Error definition has been inferred from real data and other model definitions like
// https://github.com/Azure/azure-sdk-for-go/blob/3640559afddbad452d265b54fb1c20b30be0b062/services/preview/virtualmachineimagebuilder/mgmt/2019-05-01-preview/virtualmachineimagebuilder/models.go
type AzureLogAnalyticsAPIError struct {
	Details *[]AzureLogAnalyticsAPIErrorBase `json:"details,omitempty"`
	Code    *string                          `json:"code,omitempty"`
	Message *string                          `json:"message,omitempty"`
}

type AzureLogAnalyticsAPIErrorBase struct {
	Code       *string                      `json:"code,omitempty"`
	Message    *string                      `json:"message,omitempty"`
	Innererror *AzureLogAnalyticsInnerError `json:"innererror,omitempty"`
}

type AzureLogAnalyticsInnerError struct {
	Code         *string `json:"code,omitempty"`
	Message      *string `json:"message,omitempty"`
	Severity     *int    `json:"severity,omitempty"`
	SeverityName *string `json:"severityName,omitempty"`
}

// AzureLogAnalyticsResponse is the json response object from the Azure Log Analytics API.
type AzureLogAnalyticsResponse struct {
	Tables []types.AzureResponseTable `json:"tables"`
	Error  *AzureLogAnalyticsAPIError `json:"error,omitempty"`
}

type AzureCorrelationAPIResponse struct {
	ID         string                                `json:"id"`
	Name       string                                `json:"name"`
	Type       string                                `json:"type"`
	Properties AzureCorrelationAPIResponseProperties `json:"properties"`
	Error      *AzureLogAnalyticsAPIError            `json:"error,omitempty"`
}

type AzureCorrelationAPIResponseProperties struct {
	Resources []string `json:"resources"`
	NextLink  *string  `json:"nextLink,omitempty"`
}

// GetPrimaryResultTable returns the first table in the response named "PrimaryResult", or an
// error if there is no table by that name.
func (ar *AzureLogAnalyticsResponse) GetPrimaryResultTable() (*types.AzureResponseTable, error) {
	for _, t := range ar.Tables {
		if t.Name == "PrimaryResult" {
			return &t, nil
		}
	}
	return nil, fmt.Errorf("no data as PrimaryResult table is missing from the response")
}

func (e *AzureLogAnalyticsDatasource) unmarshalResponse(logger log.Logger, res *http.Response) (AzureLogAnalyticsResponse, error) {
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return AzureLogAnalyticsResponse{}, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		logger.Debug("Request failed", "status", res.Status, "body", string(body))
		return AzureLogAnalyticsResponse{}, fmt.Errorf("request failed, status: %s, body: %s", res.Status, string(body))
	}

	var data AzureLogAnalyticsResponse
	d := json.NewDecoder(bytes.NewReader(body))
	d.UseNumber()
	err = d.Decode(&data)
	if err != nil {
		logger.Debug("Failed to unmarshal Azure Log Analytics response", "error", err, "status", res.Status, "body", string(body))
		return AzureLogAnalyticsResponse{}, err
	}

	return data, nil
}

// LogAnalyticsMeta is a type for the a Frame's Meta's Custom property.
type LogAnalyticsMeta struct {
	ColumnTypes []string `json:"azureColumnTypes"`
}

// encodeQuery encodes the query in gzip so the frontend can build links.
func encodeQuery(rawQuery string) (string, error) {
	var b bytes.Buffer
	gz := gzip.NewWriter(&b)
	if _, err := gz.Write([]byte(rawQuery)); err != nil {
		return "", err
	}

	if err := gz.Close(); err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(b.Bytes()), nil
}

func buildTracesQuery(operationId *string, traceTypes []string, filters []types.TracesFilters) string {
	types := traceTypes
	if len(types) == 0 {
		types = Tables
	}

	var tags []string
	for _, t := range types {
		tags = append(tags, getTagsForTable(t)...)
	}

	whereClause := ""

	if *operationId != "" {
		whereClause = fmt.Sprintf("| where (operation_Id != '' and operation_Id == '%s') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == '%s')", *operationId, *operationId)
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
			filtersClause += fmt.Sprintf("| where %s %s (%s) \n", filter.Property, operation, strings.Join(filterValues, ","))
		}
	}

	baseQuery := fmt.Sprintf(`set truncationmaxrecords=10000;
	set truncationmaxsize=67108864;
	union isfuzzy=true %s
	| where $__timeFilter()`, strings.Join(types, ","))
	propertiesQuery := fmt.Sprintf(`| extend duration = iff(isnull(column_ifexists("duration", real(null))), toreal(0), column_ifexists("duration", real(null)))
	| extend spanID = iff(itemType == "pageView" or isempty(column_ifexists("id", "")), tostring(new_guid()), column_ifexists("id", ""))
	| extend serviceName = iff(isempty(column_ifexists("name", "")), column_ifexists("problemId", ""), column_ifexists("name", ""))
	| extend tags = bag_pack_columns(%s)`, strings.Join(tags, ","))
	projectClause := `| project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name
	| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType
	| order by startTime asc`

	return baseQuery + whereClause + propertiesQuery + filtersClause + projectClause
}
