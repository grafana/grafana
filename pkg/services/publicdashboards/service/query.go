package service

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
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

	anonymousUser := buildAnonymousUser(ctx, dash)

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
				Color:       *anno.IconColor,
				Time:        item.Time,
				TimeEnd:     item.TimeEnd,
				Source:      anno,
			}

			// We want dashboard annotations to reference the panel they're for. If no panelId is provided, they'll show up on all panels
			// which is only intended for tag and org annotations.
			if anno.Type == "dashboard" {
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
		ctx,
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
func (pd *PublicDashboardServiceImpl) GetQueryDataResponse(ctx context.Context, skipCache bool, queryDto models.PublicDashboardQueryDTO, panelId int64, accessToken string) (*backend.QueryDataResponse, error) {
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

	anonymousUser := buildAnonymousUser(ctx, dashboard)
	res, err := pd.QueryDataService.QueryData(ctx, anonymousUser, skipCache, metricReq)

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
func (pd *PublicDashboardServiceImpl) buildMetricRequest(ctx context.Context, dashboard *dashboards.Dashboard, publicDashboard *models.PublicDashboard, panelId int64, reqDTO models.PublicDashboardQueryDTO) (dtos.MetricRequest, error) {
	// group queries by panel
	queriesByPanel := groupQueriesByPanelId(dashboard.Data)
	queries, ok := queriesByPanel[panelId]
	if !ok {
		return dtos.MetricRequest{}, models.ErrPanelNotFound.Errorf("buildMetricRequest: public dashboard panel not found")
	}

	ts := publicDashboard.BuildTimeSettings(dashboard, reqDTO)

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
func buildAnonymousUser(ctx context.Context, dashboard *dashboards.Dashboard) *user.SignedInUser {
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
	permissions[accesscontrol.ActionAnnotationsRead] = annotationScopes
	permissions[dashboards.ActionDashboardsRead] = dashboardScopes

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
			for _, target := range panel.Get("targets").MustArray() {
				target := simplejson.NewFromAny(target)
				datasourceUid := target.Get("datasource").Get("uid").MustString()
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

func getFlattenedPanels(dashboard *simplejson.Json) []interface{} {
	var flatPanels []interface{}
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

func extractQueriesFromPanels(panels []interface{}, result map[int64][]*simplejson.Json) {
	for _, panelObj := range panels {
		panel := simplejson.NewFromAny(panelObj)

		// if the panel is a row and it is collapsed, get the queries from the panels inside the row
		if panel.Get("type").MustString() == "row" && panel.Get("collapsed").MustBool() {
			// recursive call to get queries from panels inside a row
			extractQueriesFromPanels(panel.Get("panels").MustArray(), result)
			continue
		}

		var panelQueries []*simplejson.Json

		for _, queryObj := range panel.Get("targets").MustArray() {
			query := simplejson.NewFromAny(queryObj)

			// We dont support exemplars for public dashboards currently
			query.Del("exemplar")

			// if query target has no datasource, set it to have the datasource on the panel
			if _, ok := query.CheckGet("datasource"); !ok {
				uid := getDataSourceUidFromJson(panel)
				datasource := map[string]interface{}{"type": "public-ds", "uid": uid}
				query.Set("datasource", datasource)
			}
			panelQueries = append(panelQueries, query)
		}

		result[panel.Get("id").MustInt64()] = panelQueries
	}
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
				frames[i].Meta.Custom = nil
			}
		}
	}
}
