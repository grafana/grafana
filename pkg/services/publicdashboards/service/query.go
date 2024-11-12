package service

import (
	"context"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/services/user"
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

	anonymousUser := buildAnonymousUser(ctx, dash, pd.features)

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
			SignedInUser: anonymousUser,
		}

		if anno.Target != nil {
			annoQuery.Limit = anno.Target.Limit
			annoQuery.MatchAny = anno.Target.MatchAny
			if anno.Target.Type == "tags" {
				annoQuery.DashboardID = 0
				annoQuery.Tags = anno.Target.Tags
			}
		}

		annotationItems, err := pd.AnnotationsRepo.Find(ctx, annoQuery)
		if err != nil {
			return nil, models.ErrInternalServerError.Errorf("FindAnnotations: failed to find annotations: %w", err)
		}

		for _, item := range annotationItems {
			event := models.AnnotationEvent{
				Id:          item.ID,
				DashboardId: item.DashboardID,
				Tags:        item.Tags,
				IsRegion:    item.TimeEnd > 0 && item.Time != item.TimeEnd,
				Text:        item.Text,
				Color:       anno.IconColor,
				Time:        item.Time,
				TimeEnd:     item.TimeEnd,
				Source:      anno,
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

	anonymousUser := buildAnonymousUser(ctx, dashboard, pd.features)
	res, err := pd.QueryDataService.QueryData(ctx, anonymousUser, skipDSCache, metricReq)

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

// buildAnonymousUser creates a user with permissions to read from all datasources used in the dashboard
func buildAnonymousUser(ctx context.Context, dashboard *dashboards.Dashboard, features featuremgmt.FeatureToggles) *user.SignedInUser {
	datasourceUids := getUniqueDashboardDatasourceUids(dashboard.Data)

	// Create a user with blank permissions
	anonymousUser := &user.SignedInUser{OrgID: dashboard.OrgID, Permissions: make(map[int64]map[string][]string)}

	// Scopes needed for Annotation queries
	annotationScopes := []string{accesscontrol.ScopeAnnotationsTypeDashboard}
	// Need to access all dashboards since tags annotations span across all dashboards
	dashboardScopes := []string{dashboards.ScopeDashboardsProvider.GetResourceAllScope()}

	// Scopes needed for datasource queries
	queryScopes := make([]string, 0)
	readScopes := make([]string, 0)
	for _, uid := range datasourceUids {
		scope := datasources.ScopeProvider.GetResourceScopeUID(uid)
		queryScopes = append(queryScopes, scope)
		readScopes = append(readScopes, scope)
	}

	// Apply all scopes to the actions we need the user to be able to perform
	permissions := make(map[string][]string)
	permissions[datasources.ActionQuery] = queryScopes
	permissions[datasources.ActionRead] = readScopes
	permissions[dashboards.ActionDashboardsRead] = dashboardScopes
	permissions[accesscontrol.ActionAnnotationsRead] = annotationScopes

	if features.IsEnabled(ctx, featuremgmt.FlagAnnotationPermissionUpdate) {
		permissions[accesscontrol.ActionAnnotationsRead] = dashboardScopes
	}

	anonymousUser.Permissions[dashboard.OrgID] = permissions

	return anonymousUser
}

func getUniqueDashboardDatasourceUids(dashboard *simplejson.Json) []string {
	var datasourceUids []string
	exists := map[string]bool{}

	// collapsed rows contain panels in a nested structure, so we need to flatten them before calculate unique uids
	flattenedPanels := getFlattenedPanels(dashboard)

	for _, panelObj := range flattenedPanels {
		panel := simplejson.NewFromAny(panelObj)
		uid := getDataSourceUidFromJson(panel)

		// if uid is for a mixed datasource, get the datasource uids from the targets
		if uid == "-- Mixed --" {
			for _, targetObj := range panel.Get("targets").MustArray() {
				target := simplejson.NewFromAny(targetObj)
				datasourceUid := getDataSourceUidFromJson(target)
				if _, ok := exists[datasourceUid]; !ok {
					datasourceUids = append(datasourceUids, datasourceUid)
					exists[datasourceUid] = true
				}
			}
		} else {
			if _, ok := exists[uid]; !ok {
				datasourceUids = append(datasourceUids, uid)
				exists[uid] = true
			}
		}
	}

	return datasourceUids
}

func getFlattenedPanels(dashboard *simplejson.Json) []any {
	var flatPanels []any
	for _, panelObj := range dashboard.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)
		// if the panel is a row and it is collapsed, get the queries from the panels inside the row
		// if it is not collapsed, the row does not have any panels
		if panel.Get("type").MustString() == "row" {
			if panel.Get("collapsed").MustBool() {
				flatPanels = append(flatPanels, panel.Get("panels").MustArray()...)
			}
		} else {
			flatPanels = append(flatPanels, panelObj)
		}
	}
	return flatPanels
}

func groupQueriesByPanelId(dashboard *simplejson.Json) map[int64][]*simplejson.Json {
	result := make(map[int64][]*simplejson.Json)

	extractQueriesFromPanels(dashboard.Get("panels").MustArray(), result)

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
				uid := getDataSourceUidFromJson(panel)
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

func getDataSourceUidFromJson(query *simplejson.Json) string {
	uid := query.Get("datasource").Get("uid").MustString()

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

func getPanelRelativeTimeRange(dashboard *simplejson.Json, panelID int64) string {
	for _, panelObj := range dashboard.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)

		if panel.Get("id").MustInt64() == panelID {
			return panel.Get("timeFrom").MustString()
		}
	}

	return ""
}
