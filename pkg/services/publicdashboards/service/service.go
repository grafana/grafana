package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

// Define the Service Implementation. We're generating mock implementation
// automatically
type PublicDashboardServiceImpl struct {
	log                log.Logger
	cfg                *setting.Cfg
	store              publicdashboards.Store
	intervalCalculator intervalv2.Calculator
	QueryDataService   *query.Service
}

var LogPrefix = "publicdashboards.service"

// Gives us compile time error if the service does not adhere to the contract of
// the interface
var _ publicdashboards.Service = (*PublicDashboardServiceImpl)(nil)

// Factory for method used by wire to inject dependencies.
// builds the service, and api, and configures routes
func ProvideService(
	cfg *setting.Cfg,
	store publicdashboards.Store,
	qds *query.Service,
) *PublicDashboardServiceImpl {
	return &PublicDashboardServiceImpl{
		log:                log.New(LogPrefix),
		cfg:                cfg,
		store:              store,
		intervalCalculator: intervalv2.NewCalculator(),
		QueryDataService:   qds,
	}
}

func (pd *PublicDashboardServiceImpl) GetDashboard(ctx context.Context, dashboardUid string) (*models.Dashboard, error) {
	dashboard, err := pd.store.GetDashboard(ctx, dashboardUid)

	if err != nil {
		return nil, err
	}

	return dashboard, err
}

// Gets public dashboard via access token
func (pd *PublicDashboardServiceImpl) GetPublicDashboard(ctx context.Context, accessToken string) (*models.Dashboard, error) {
	pubdash, d, err := pd.store.GetPublicDashboard(ctx, accessToken)

	if err != nil {
		return nil, err
	}

	if pubdash == nil || d == nil {
		return nil, ErrPublicDashboardNotFound
	}

	if !pubdash.IsEnabled {
		return nil, ErrPublicDashboardNotFound
	}

	ts := pubdash.BuildTimeSettings(d)
	d.Data.SetPath([]string{"time", "from"}, ts.From)
	d.Data.SetPath([]string{"time", "to"}, ts.To)

	return d, nil
}

// GetPublicDashboardConfig is a helper method to retrieve the public dashboard configuration for a given dashboard from the database
func (pd *PublicDashboardServiceImpl) GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error) {
	pdc, err := pd.store.GetPublicDashboardConfig(ctx, orgId, dashboardUid)
	if err != nil {
		return nil, err
	}

	return pdc, nil
}

// SavePublicDashboardConfig is a helper method to persist the sharing config
// to the database. It handles validations for sharing config and persistence
func (pd *PublicDashboardServiceImpl) SavePublicDashboardConfig(ctx context.Context, dto *SavePublicDashboardConfigDTO) (*PublicDashboard, error) {
	dashboard, err := pd.GetDashboard(ctx, dto.DashboardUid)
	if err != nil {
		return nil, err
	}
	err = validation.ValidateSavePublicDashboard(dto, dashboard)
	if err != nil {
		return nil, err
	}

	// set default value for time settings
	if dto.PublicDashboard.TimeSettings == nil {
		dto.PublicDashboard.TimeSettings = simplejson.New()
	}

	if dto.PublicDashboard.Uid == "" {
		return pd.savePublicDashboardConfig(ctx, dto)
	}

	return pd.updatePublicDashboardConfig(ctx, dto)
}

func (pd *PublicDashboardServiceImpl) savePublicDashboardConfig(ctx context.Context, dto *SavePublicDashboardConfigDTO) (*PublicDashboard, error) {
	uid, err := pd.store.GenerateNewPublicDashboardUid(ctx)
	if err != nil {
		return nil, err
	}

	accessToken, err := GenerateAccessToken()
	if err != nil {
		return nil, err
	}

	cmd := SavePublicDashboardConfigCommand{
		DashboardUid: dto.DashboardUid,
		OrgId:        dto.OrgId,
		PublicDashboard: PublicDashboard{
			Uid:          uid,
			DashboardUid: dto.DashboardUid,
			OrgId:        dto.OrgId,
			IsEnabled:    dto.PublicDashboard.IsEnabled,
			TimeSettings: dto.PublicDashboard.TimeSettings,
			CreatedBy:    dto.UserId,
			CreatedAt:    time.Now(),
			AccessToken:  accessToken,
		},
	}

	return pd.store.SavePublicDashboardConfig(ctx, cmd)
}

func (pd *PublicDashboardServiceImpl) updatePublicDashboardConfig(ctx context.Context, dto *SavePublicDashboardConfigDTO) (*PublicDashboard, error) {
	cmd := SavePublicDashboardConfigCommand{
		PublicDashboard: PublicDashboard{
			Uid:          dto.PublicDashboard.Uid,
			IsEnabled:    dto.PublicDashboard.IsEnabled,
			TimeSettings: dto.PublicDashboard.TimeSettings,
			UpdatedBy:    dto.UserId,
			UpdatedAt:    time.Now(),
		},
	}

	err := pd.store.UpdatePublicDashboardConfig(ctx, cmd)
	if err != nil {
		return nil, err
	}

	publicDashboard, err := pd.store.GetPublicDashboardConfig(ctx, dto.OrgId, dto.DashboardUid)
	if err != nil {
		return nil, err
	}

	return publicDashboard, nil
}

func (pd *PublicDashboardServiceImpl) GetQueryDataResponse(ctx context.Context, skipCache bool, reqDTO *PublicDashboardQueryDTO, panelId int64, accessToken string) (*backend.QueryDataResponse, error) {
	if err := validation.ValidateQueryPublicDashboardRequest(reqDTO); err != nil {
		return nil, ErrPublicDashboardBadRequest
	}

	dashboard, err := pd.GetPublicDashboard(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	publicDashboard, err := pd.GetPublicDashboardConfig(ctx, dashboard.OrgId, dashboard.Uid)
	if err != nil {
		return nil, err
	}

	if !publicDashboard.IsEnabled {
		return nil, ErrPublicDashboardNotFound
	}

	metricReqDTO, err := pd.buildPublicDashboardMetricRequest(
		ctx,
		dashboard,
		publicDashboard,
		panelId,
		reqDTO,
	)
	if err != nil {
		return nil, err
	}

	anonymousUser, err := pd.BuildAnonymousUser(ctx, dashboard)
	if err != nil {
		return nil, err
	}

	resp, err := pd.QueryDataService.QueryDataMultipleSources(ctx, anonymousUser, skipCache, metricReqDTO, true)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

// BuildPublicDashboardMetricRequest merges public dashboard parameters with
// dashboard and returns a metrics request to be sent to query backend
func (pd *PublicDashboardServiceImpl) buildPublicDashboardMetricRequest(ctx context.Context, dashboard *models.Dashboard, publicDashboard *PublicDashboard, panelId int64, reqDTO *PublicDashboardQueryDTO) (dtos.MetricRequest, error) {
	// group queries by panel
	queriesByPanel := models.GroupQueriesByPanelId(dashboard.Data)
	queries, ok := queriesByPanel[panelId]
	if !ok {
		return dtos.MetricRequest{}, ErrPublicDashboardPanelNotFound
	}

	ts := publicDashboard.BuildTimeSettings(dashboard)

	// determine safe resolution to query data at
	safeInterval, safeResolution := pd.getSafeIntervalAndMaxDataPoints(reqDTO, ts)
	for i := range queries {
		queries[i].Set("intervalMs", safeInterval)
		queries[i].Set("maxDataPoints", safeResolution)
	}

	return dtos.MetricRequest{
		From:    ts.From,
		To:      ts.To,
		Queries: queries,
	}, nil
}

// BuildAnonymousUser creates a user with permissions to read from all datasources used in the dashboard
func (pd *PublicDashboardServiceImpl) BuildAnonymousUser(ctx context.Context, dashboard *models.Dashboard) (*user.SignedInUser, error) {
	datasourceUids := models.GetUniqueDashboardDatasourceUids(dashboard.Data)

	// Create a temp user with read-only datasource permissions
	anonymousUser := &user.SignedInUser{OrgID: dashboard.OrgId, Permissions: make(map[int64]map[string][]string)}
	permissions := make(map[string][]string)
	queryScopes := make([]string, 0)
	readScopes := make([]string, 0)
	for _, uid := range datasourceUids {
		queryScopes = append(queryScopes, fmt.Sprintf("datasources:uid:%s", uid))
		readScopes = append(readScopes, fmt.Sprintf("datasources:uid:%s", uid))
	}
	permissions[datasources.ActionQuery] = queryScopes
	permissions[datasources.ActionRead] = readScopes
	anonymousUser.Permissions[dashboard.OrgId] = permissions

	return anonymousUser, nil
}

func (pd *PublicDashboardServiceImpl) PublicDashboardEnabled(ctx context.Context, dashboardUid string) (bool, error) {
	return pd.store.PublicDashboardEnabled(ctx, dashboardUid)
}

func (pd *PublicDashboardServiceImpl) AccessTokenExists(ctx context.Context, accessToken string) (bool, error) {
	return pd.store.AccessTokenExists(ctx, accessToken)
}

// generates a uuid formatted without dashes to use as access token
func GenerateAccessToken() (string, error) {
	token, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", token[:]), nil
}

// intervalMS and maxQueryData values are being calculated on the frontend for regular dashboards
// we are doing the same for public dashboards but because this access would be public, we need a way to keep this
// values inside reasonable bounds to avoid an attack that could hit data sources with a small interval and a big
// time range and perform big calculations
// this is an additional validation, all data sources implements QueryData interface and should have proper validations
// of these limits
// for the maxDataPoints we took a hard limit from prometheus which is 11000
func (pd *PublicDashboardServiceImpl) getSafeIntervalAndMaxDataPoints(reqDTO *PublicDashboardQueryDTO, ts *TimeSettings) (int64, int64) {
	// arbitrary max value for all data sources, it is actually a hard limit defined in prometheus
	safeResolution := int64(11000)

	// interval calculated on the frontend
	interval := time.Duration(reqDTO.IntervalMs) * time.Millisecond

	// calculate a safe interval with time range from dashboard and safeResolution
	dataTimeRange := legacydata.NewDataTimeRange(ts.From, ts.To)
	tr := backend.TimeRange{
		From: dataTimeRange.GetFromAsTimeUTC(),
		To:   dataTimeRange.GetToAsTimeUTC(),
	}
	safeInterval := pd.intervalCalculator.CalculateSafeInterval(tr, safeResolution)

	if interval > safeInterval.Value {
		return reqDTO.IntervalMs, reqDTO.MaxDataPoints
	}

	return safeInterval.Value.Milliseconds(), safeResolution
}
