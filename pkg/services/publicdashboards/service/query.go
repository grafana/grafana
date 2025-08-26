package service

import (
	"context"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
)

// FindAnnotations returns annotations for a public dashboard
func (pd *PublicDashboardServiceImpl) FindAnnotations(ctx context.Context, reqDTO models.AnnotationsQueryDTO, accessToken string) ([]models.AnnotationEvent, error) {
	pub, dash, err := pd.FindEnabledPublicDashboardAndDashboardByAccessToken(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	if !pub.AnnotationsEnabled {
		return []models.AnnotationEvent{}, nil
	}

	annoDto, err := UnmarshalDashboardAnnotations(dash.Data)
	if err != nil {
		return nil, models.ErrInternalServerError.Errorf("FindAnnotations: failed to unmarshal dashboard annotations: %w", err)
	}

	// We don't have a signed in user for public dashboards. We are using Grafana's Identity to query the annotations.
	svcCtx, svcIdent := identity.WithServiceIdentity(ctx, dash.OrgID)
	uniqueEvents := make(map[int64]models.AnnotationEvent, 0)
	for _, anno := range annoDto.Annotations.List {
		// skip annotations that are not enabled or are not a grafana datasource
		if !anno.Enable || (*anno.Datasource.Uid != grafanads.DatasourceUID && *anno.Datasource.Uid != grafanads.DatasourceName) {
			continue
		}
		annoQuery := &annotations.ItemQuery{
			From:         reqDTO.From,
			To:           reqDTO.To,
			OrgID:        dash.OrgID,
			DashboardID:  dash.ID,
			DashboardUID: dash.UID,
			SignedInUser: svcIdent,
		}

		if anno.Target != nil {
			annoQuery.Limit = anno.Target.Limit
			annoQuery.MatchAny = anno.Target.MatchAny
			if anno.Target.Type == "tags" {
				annoQuery.DashboardID = 0 // nolint: staticcheck
				annoQuery.DashboardUID = ""
				annoQuery.Tags = anno.Target.Tags
			}
		}

		annotationItems, err := pd.AnnotationsRepo.Find(svcCtx, annoQuery)
		if err != nil {
			return nil, models.ErrInternalServerError.Errorf("FindAnnotations: failed to find annotations: %w", err)
		}

		for _, item := range annotationItems {
			event := models.AnnotationEvent{
				Id:          item.ID,
				DashboardId: item.DashboardID, // nolint: staticcheck
				Tags:        item.Tags,
				IsRegion:    item.TimeEnd > 0 && item.Time != item.TimeEnd,
				Text:        item.Text,
				Color:       anno.IconColor,
				Time:        item.Time,
				TimeEnd:     item.TimeEnd,
				Source:      anno,
			}

			if item.DashboardUID != nil {
				event.DashboardUID = *item.DashboardUID
			}

			// We want dashboard annotations to reference the panel they're for. If no panelId is provided, they'll show up on all panels
			// which is only intended for tag and org annotations.
			if anno.Type != nil && *anno.Type == "dashboard" {
				event.PanelId = item.PanelID
			}

			// We want events from tag queries to overwrite existing events
			_, has := uniqueEvents[event.Id]
			if !has || (has && anno.Target != nil && anno.Target.Type == "tags") {
				uniqueEvents[event.Id] = event
			}
		}
	}

	results := make([]models.AnnotationEvent, 0, len(uniqueEvents))
	for _, result := range uniqueEvents {
		results = append(results, result)
	}

	return results, nil
}

// GetMetricRequest returns a metric request for the given panel and query
func (pd *PublicDashboardServiceImpl) GetMetricRequest(ctx context.Context, dashboard *dashboards.Dashboard, publicDashboard *models.PublicDashboard, panelId int64, queryDto models.PublicDashboardQueryDTO) (dtos.MetricRequest, error) {
	err := validation.ValidateQueryPublicDashboardRequest(queryDto, publicDashboard)
	if err != nil {
		return dtos.MetricRequest{}, err
	}

	metricReqDTO, err := pd.buildMetricRequest(
		dashboard,
		publicDashboard,
		panelId,
		queryDto,
	)
	if err != nil {
		return dtos.MetricRequest{}, err
	}

	return metricReqDTO, nil
}

// GetQueryDataResponse returns a query data response for the given panel and query
func (pd *PublicDashboardServiceImpl) GetQueryDataResponse(ctx context.Context, skipDSCache bool, queryDto models.PublicDashboardQueryDTO, panelId int64, accessToken string) (*backend.QueryDataResponse, error) {
	publicDashboard, dashboard, err := pd.FindEnabledPublicDashboardAndDashboardByAccessToken(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	metricReq, err := pd.GetMetricRequest(ctx, dashboard, publicDashboard, panelId, queryDto)
	if err != nil {
		return nil, err
	}

	if len(metricReq.Queries) == 0 {
		return nil, models.ErrPanelQueriesNotFound.Errorf("GetQueryDataResponse: failed to extract queries from panel")
	}

	// We don't have a signed in user for public dashboards. We are using Grafana's Identity to query the datasource.
	svcCtx, svcIdent := identity.WithServiceIdentity(ctx, dashboard.OrgID)
	res, err := pd.QueryDataService.QueryData(svcCtx, svcIdent, skipDSCache, metricReq)

	reqDatasources := metricReq.GetUniqueDatasourceTypes()
	if err != nil {
		LogQueryFailure(reqDatasources, pd.log, err)
		return nil, err
	}
	LogQuerySuccess(reqDatasources, pd.log)

	sanitizeMetadataFromQueryData(res)

	return res, nil
}

// buildMetricRequest merges public dashboard parameters with dashboard and returns a metrics request to be sent to query backend
func (pd *PublicDashboardServiceImpl) buildMetricRequest(dashboard *dashboards.Dashboard, publicDashboard *models.PublicDashboard, panelID int64, reqDTO models.PublicDashboardQueryDTO) (dtos.MetricRequest, error) {
	isV2 := dashboard.Data.Get("elements").Interface() != nil

	if isV2 {
		return pd.buildMetricRequestV2(dashboard, publicDashboard, panelID, reqDTO)
	}

	// group queries by panel
	queriesByPanel := groupQueriesByPanelId(dashboard.Data)
	queries, ok := queriesByPanel[panelID]
	if !ok {
		return dtos.MetricRequest{}, models.ErrPanelNotFound.Errorf("buildMetricRequest: public dashboard panel not found")
	}

	ts := buildTimeSettings(dashboard, reqDTO, publicDashboard, panelID)

	// determine safe resolution to query data at
	safeInterval, safeResolution := pd.getSafeIntervalAndMaxDataPoints(reqDTO, ts)
	for i := range queries {
		queries[i].Set("intervalMs", safeInterval)
		queries[i].Set("maxDataPoints", safeResolution)
		queries[i].Set("queryCachingTTL", reqDTO.QueryCachingTTL)
	}

	return dtos.MetricRequest{
		From:    ts.From,
		To:      ts.To,
		Queries: queries,
	}, nil
}

func (pd *PublicDashboardServiceImpl) buildMetricRequestV2(dashboard *dashboards.Dashboard, publicDashboard *models.PublicDashboard, panelID int64, reqDTO models.PublicDashboardQueryDTO) (dtos.MetricRequest, error) {
	// group queries by panel for V2
	queriesByPanel := groupQueriesByPanelIdV2(dashboard.Data)
	queries, ok := queriesByPanel[panelID]
	if !ok {
		return dtos.MetricRequest{}, models.ErrPanelNotFound.Errorf("buildMetricRequestV2: public dashboard panel not found")
	}

	ts := buildTimeSettingsV2(dashboard, reqDTO, publicDashboard, panelID)

	// determine safe resolution to query data at
	safeInterval, safeResolution := pd.getSafeIntervalAndMaxDataPoints(reqDTO, ts)
	for i := range queries {
		queries[i].Set("intervalMs", safeInterval)
		queries[i].Set("maxDataPoints", safeResolution)
		queries[i].Set("queryCachingTTL", reqDTO.QueryCachingTTL)
	}

	return dtos.MetricRequest{
		From:    ts.From,
		To:      ts.To,
		Queries: queries,
	}, nil
}

func groupQueriesByPanelId(dashboard *simplejson.Json) map[int64][]*simplejson.Json {
	result := make(map[int64][]*simplejson.Json)

	extractQueriesFromPanels(dashboard.Get("panels").MustArray(), result)

	return result
}

func groupQueriesByPanelIdV2(dashboard *simplejson.Json) map[int64][]*simplejson.Json {
	result := make(map[int64][]*simplejson.Json)

	elementsMap := dashboard.Get("elements").MustMap()
	for _, element := range elementsMap {
		element := simplejson.NewFromAny(element)

		var panelQueries []*simplejson.Json
		hasExpression := panelHasAnExpressionSchemaV2(element)

		// For schema v2, queries are nested in element.spec.data.spec.queries
		spec := element.Get("spec")
		if spec.Interface() == nil {
			result[element.Get("spec").Get("id").MustInt64()] = panelQueries
			continue
		}

		data := spec.Get("data")
		if data.Interface() == nil {
			result[element.Get("spec").Get("id").MustInt64()] = panelQueries
			continue
		}

		dataSpec := data.Get("spec")
		if dataSpec.Interface() == nil {
			result[element.Get("spec").Get("id").MustInt64()] = panelQueries
			continue
		}

		queries := dataSpec.Get("queries")
		if queries.Interface() == nil {
			result[element.Get("spec").Get("id").MustInt64()] = panelQueries
			continue
		}

		for _, queryObj := range queries.MustArray() {
			query := simplejson.NewFromAny(queryObj)

			// Check if query is hidden (PanelQuery.spec.hidden)
			panelQuerySpec := query.Get("spec")
			if panelQuerySpec.Interface() == nil {
				continue
			}

			if !hasExpression && panelQuerySpec.Get("hidden").MustBool() {
				continue
			}

			// Extract the actual query from PanelQuery.spec.query
			dataQueryKind := panelQuerySpec.Get("query")
			if dataQueryKind.Interface() == nil {
				continue
			}

			dataQuerySpec := dataQueryKind.Get("spec")
			if dataQuerySpec.Interface() == nil {
				continue
			}

			dataQuerySpec.Del("exemplar")

			group := dataQueryKind.Get("group").MustString()

			// if query target has no datasource, set it to have the datasource on the panel
			if _, ok := dataQuerySpec.CheckGet("datasource"); !ok {
				uid := getDataSourceUidFromJsonSchemaV2(dataQueryKind)
				datasource := map[string]any{"type": group, "uid": uid}
				dataQuerySpec.Set("datasource", datasource)
			}

			// We don't support exemplars for public dashboards currently
			dataQuerySpec.Del("exemplar")

			// The query object contains the DataQuery with the actual expression
			panelQueries = append(panelQueries, dataQuerySpec)
		}

		result[element.Get("spec").Get("id").MustInt64()] = panelQueries
	}

	return result
}

func extractQueriesFromPanels(panels []any, result map[int64][]*simplejson.Json) {
	for _, panelObj := range panels {
		panel := simplejson.NewFromAny(panelObj)

		// if the panel is a row and it is collapsed, get the queries from the panels inside the row
		if panel.Get("type").MustString() == "row" && panel.Get("collapsed").MustBool() {
			// recursive call to get queries from panels inside a row
			extractQueriesFromPanels(panel.Get("panels").MustArray(), result)
			continue
		}

		var panelQueries []*simplejson.Json
		hasExpression := panelHasAnExpression(panel)

		for _, queryObj := range panel.Get("targets").MustArray() {
			query := simplejson.NewFromAny(queryObj)

			// it the panel doesn't have an expression and the query is disabled (hide is true), skip the query
			// the expression handler will take care later of removing hidden queries which could be necessary to calculate
			// the value of other queries
			if !hasExpression && query.Get("hide").MustBool() {
				continue
			}

			// We don't support exemplars for public dashboards currently
			query.Del("exemplar")

			// if query target has no datasource, set it to have the datasource on the panel
			if _, ok := query.CheckGet("datasource"); !ok {
				uid := getDataSourceUidFromJson(query)
				datasource := map[string]any{"type": "public-ds", "uid": uid}
				query.Set("datasource", datasource)
			}
			panelQueries = append(panelQueries, query)
		}

		result[panel.Get("id").MustInt64()] = panelQueries
	}
}

func panelHasAnExpression(panel *simplejson.Json) bool {
	var hasExpression bool
	for _, queryObj := range panel.Get("targets").MustArray() {
		query := simplejson.NewFromAny(queryObj)
		if expr.NodeTypeFromDatasourceUID(getDataSourceUidFromJson(query)) == expr.TypeCMDNode {
			hasExpression = true
		}
	}
	return hasExpression
}

func panelHasAnExpressionSchemaV2(panel *simplejson.Json) bool {
	var hasExpression bool

	// For schema v2, check the nested structure: spec.data.spec.queries[].spec.query
	spec := panel.Get("spec")
	if spec.Interface() == nil {
		return hasExpression
	}

	data := spec.Get("data")
	if data.Interface() == nil {
		return hasExpression
	}

	dataSpec := data.Get("spec")
	if dataSpec.Interface() == nil {
		return hasExpression
	}

	queries := dataSpec.Get("queries")
	if queries.Interface() == nil {
		return hasExpression
	}

	for _, queryObj := range queries.MustArray() {
		query := simplejson.NewFromAny(queryObj)

		// Navigate to the actual query object
		querySpec := query.Get("spec")
		if querySpec.Interface() == nil {
			continue
		}

		queryData := querySpec.Get("query")
		if queryData.Interface() == nil {
			continue
		}

		// Check if this query is an expression
		if expr.NodeTypeFromDatasourceUID(getDataSourceUidFromJsonSchemaV2(queryData)) == expr.TypeCMDNode {
			hasExpression = true
			break
		}
	}

	return hasExpression
}

func getDataSourceUidFromJson(query *simplejson.Json) string {
	uid := query.Get("datasource").Get("uid").MustString()

	// before 8.3 special types could be sent as datasource (expr)
	if uid == "" {
		uid = query.Get("datasource").MustString()
	}

	return uid
}

func getDataSourceUidFromJsonSchemaV2(query *simplejson.Json) string {
	// For schema v2, datasource info is in query.datasource
	uid := query.Get("datasource").Get("name").MustString()

	// before 8.3 special types could be sent as datasource (expr)
	if uid == "" {
		uid = query.Get("datasource").MustString()
	}

	return uid
}

func sanitizeMetadataFromQueryData(res *backend.QueryDataResponse) {
	for k := range res.Responses {
		frames := res.Responses[k].Frames
		for i := range frames {
			if frames[i].Meta != nil {
				frames[i].Meta.ExecutedQueryString = ""
			}
		}
	}
}

// sanitizeData removes the query expressions from the dashboard data
func sanitizeData(data *simplejson.Json) {
	for _, panelObj := range data.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)

		// if the panel is a row and it is collapsed, get the queries from the panels inside the row
		if panel.Get("type").MustString() == "row" && panel.Get("collapsed").MustBool() {
			// recursive call to get queries from panels inside a row
			sanitizeData(panel)
			continue
		}

		for _, targetObj := range panel.Get("targets").MustArray() {
			target := simplejson.NewFromAny(targetObj)
			target.Del("expr")
			target.Del("query")
			target.Del("rawSql")
		}
	}
}

// NewTimeRange declared to be able to stub this function in tests
var NewTimeRange = gtime.NewTimeRange

// BuildTimeSettings build time settings object using selected values if enabled and are valid or dashboard default values
func buildTimeSettings(d *dashboards.Dashboard, reqDTO models.PublicDashboardQueryDTO, pd *models.PublicDashboard, panelID int64) models.TimeSettings {
	from, to, timezone := getTimeRangeValuesOrDefault(reqDTO, d, pd.TimeSelectionEnabled, panelID)

	timeRange := NewTimeRange(from, to)

	timeFrom, _ := timeRange.ParseFrom(
		gtime.WithLocation(timezone),
	)
	timeTo, _ := timeRange.ParseTo(
		gtime.WithLocation(timezone),
	)
	timeToAsEpoch := timeTo.UnixMilli()
	timeFromAsEpoch := timeFrom.UnixMilli()

	// Were using epoch ms because this is used to build a MetricRequest, which is used by query caching, which want the time range in epoch milliseconds.
	return models.TimeSettings{
		From: strconv.FormatInt(timeFromAsEpoch, 10),
		To:   strconv.FormatInt(timeToAsEpoch, 10),
	}
}

// buildTimeSettingsV2 builds time settings for V2 dashboards
func buildTimeSettingsV2(d *dashboards.Dashboard, reqDTO models.PublicDashboardQueryDTO, pd *models.PublicDashboard, panelID int64) models.TimeSettings {
	from, to, timezone := getTimeRangeValuesOrDefaultV2(d, reqDTO, pd.TimeSelectionEnabled, panelID)

	timeRange := NewTimeRange(from, to)

	timeFrom, _ := timeRange.ParseFrom(
		gtime.WithLocation(timezone),
	)
	timeTo, _ := timeRange.ParseTo(
		gtime.WithLocation(timezone),
	)
	timeToAsEpoch := timeTo.UnixMilli()
	timeFromAsEpoch := timeFrom.UnixMilli()

	// Were using epoch ms because this is used to build a MetricRequest, which is used by query caching, which want the time range in epoch milliseconds.
	return models.TimeSettings{
		From: strconv.FormatInt(timeFromAsEpoch, 10),
		To:   strconv.FormatInt(timeToAsEpoch, 10),
	}
}

// returns from, to and timezone from the request if the timeSelection is enabled or the dashboard default values
func getTimeRangeValuesOrDefault(reqDTO models.PublicDashboardQueryDTO, d *dashboards.Dashboard, timeSelectionEnabled bool, panelID int64) (string, string, *time.Location) {
	from := d.Data.GetPath("time", "from").MustString()
	to := d.Data.GetPath("time", "to").MustString()
	dashboardTimezone := d.Data.GetPath("timezone").MustString()

	panelRelativeTime := getPanelRelativeTimeRange(d.Data, panelID)
	if panelRelativeTime != "" {
		from = panelRelativeTime
	}

	// we use the values from the request if the time selection is enabled and the values are valid
	if timeSelectionEnabled {
		if reqDTO.TimeRange.From != "" && reqDTO.TimeRange.To != "" {
			from = reqDTO.TimeRange.From
			to = reqDTO.TimeRange.To
		}

		if reqDTO.TimeRange.Timezone != "" {
			if userTimezone, err := time.LoadLocation(reqDTO.TimeRange.Timezone); err == nil {
				return from, to, userTimezone
			}
		}
	}

	// if the dashboardTimezone is blank or there is an error default is UTC
	timezone, err := time.LoadLocation(dashboardTimezone)
	if err != nil {
		return from, to, time.UTC
	}

	return from, to, timezone
}

// getTimeRangeValuesOrDefaultV2 returns from, to and timezone from the request if the timeSelection is enabled or the dashboard default values for V2
func getTimeRangeValuesOrDefaultV2(d *dashboards.Dashboard, reqDTO models.PublicDashboardQueryDTO, timeSelectionEnabled bool, panelID int64) (string, string, *time.Location) {
	// In V2, time settings are in dashboard.timeSettings
	timeSettings := d.Data.Get("timeSettings")
	from := timeSettings.Get("from").MustString()
	to := timeSettings.Get("to").MustString()
	dashboardTimezone := timeSettings.Get("timezone").MustString()

	// Check for panel-specific time override in V2 structure
	panelRelativeTime := getPanelRelativeTimeRangeV2(d.Data, panelID)
	if panelRelativeTime != "" {
		from = panelRelativeTime
	}

	// we use the values from the request if the time selection is enabled and the values are valid
	if timeSelectionEnabled {
		if reqDTO.TimeRange.From != "" && reqDTO.TimeRange.To != "" {
			from = reqDTO.TimeRange.From
			to = reqDTO.TimeRange.To
		}

		if reqDTO.TimeRange.Timezone != "" {
			if userTimezone, err := time.LoadLocation(reqDTO.TimeRange.Timezone); err == nil {
				return from, to, userTimezone
			}
		}
	}

	// if the dashboardTimezone is blank or there is an error default is UTC
	timezone, err := time.LoadLocation(dashboardTimezone)
	if err != nil {
		return from, to, time.UTC
	}

	return from, to, timezone
}

func getPanelRelativeTimeRange(dashboard *simplejson.Json, panelID int64) string {
	for _, panelObj := range dashboard.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)

		if panel.Get("id").MustInt64() == panelID {
			return panel.Get("timeFrom").MustString()
		}
	}

	return ""
}

func getPanelRelativeTimeRangeV2(dashboard *simplejson.Json, panelID int64) string {
	// In V2, check elements for panel-specific time settings
	if elements := dashboard.Get("elements"); elements.Interface() != nil {
		elementsMap := elements.MustMap()
		for _, element := range elementsMap {
			element := simplejson.NewFromAny(element)

			// Check if this is the panel we're looking for
			if element.Get("spec").Get("id").MustInt64() == panelID {
				// Check for time override in data.spec.queryOptions.timeFrom
				if spec := element.Get("spec"); spec.Interface() != nil {
					if data := spec.Get("data"); data.Interface() != nil {
						if dataSpec := data.Get("spec"); dataSpec.Interface() != nil {
							if queryOptions := dataSpec.Get("queryOptions"); queryOptions.Interface() != nil {
								if timeFrom := queryOptions.Get("timeFrom"); timeFrom.Interface() != nil {
									return timeFrom.MustString()
								}
							}
						}
					}
				}
				break
			}
		}
	}

	return ""
}
