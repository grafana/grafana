package service

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

// PublicDashboardServiceImpl Define the Service Implementation. We're generating mock implementation
// automatically
type PublicDashboardServiceImpl struct {
	log                log.Logger
	cfg                *setting.Cfg
	store              publicdashboards.Store
	intervalCalculator intervalv2.Calculator
	QueryDataService   *query.Service
	AnnotationsRepo    annotations.Repository
	ac                 accesscontrol.AccessControl
}

var LogPrefix = "publicdashboards.service"

// Gives us compile time error if the service does not adhere to the contract of
// the interface
var _ publicdashboards.Service = (*PublicDashboardServiceImpl)(nil)

// ProvideService Factory for method used by wire to inject dependencies.
// builds the service, and api, and configures routes
func ProvideService(
	cfg *setting.Cfg,
	store publicdashboards.Store,
	qds *query.Service,
	anno annotations.Repository,
	ac accesscontrol.AccessControl,
) *PublicDashboardServiceImpl {
	return &PublicDashboardServiceImpl{
		log:                log.New(LogPrefix),
		cfg:                cfg,
		store:              store,
		intervalCalculator: intervalv2.NewCalculator(),
		QueryDataService:   qds,
		AnnotationsRepo:    anno,
		ac:                 ac,
	}
}

// GetDashboard Gets a dashboard by Uid
func (pd *PublicDashboardServiceImpl) GetDashboard(ctx context.Context, dashboardUid string) (*models.Dashboard, error) {
	dashboard, err := pd.store.GetDashboard(ctx, dashboardUid)

	if err != nil {
		return nil, err
	}

	return dashboard, err
}

// GetPublicDashboard Gets public dashboard via access token
func (pd *PublicDashboardServiceImpl) GetPublicDashboard(ctx context.Context, accessToken string) (*PublicDashboard, *models.Dashboard, error) {
	pubdash, dash, err := pd.store.GetPublicDashboard(ctx, accessToken)
	ctxLogger := pd.log.FromContext(ctx)

	if err != nil {
		return nil, nil, err
	}

	if pubdash == nil {
		ctxLogger.Error("GetPublicDashboard: Public dashboard not found", "accessToken", accessToken)
		return nil, nil, ErrPublicDashboardNotFound
	}

	if dash == nil {
		ctxLogger.Error("GetPublicDashboard: Dashboard not found", "accessToken", accessToken)
		return nil, nil, ErrPublicDashboardNotFound
	}

	if !pubdash.IsEnabled {
		ctxLogger.Error("GetPublicDashboard: Public dashboard is disabled", "accessToken", accessToken)
		return nil, nil, ErrPublicDashboardNotFound
	}

	return pubdash, dash, nil
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
func (pd *PublicDashboardServiceImpl) SavePublicDashboardConfig(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardConfigDTO) (*PublicDashboard, error) {
	// validate if the dashboard exists
	dashboard, err := pd.GetDashboard(ctx, dto.DashboardUid)
	if err != nil {
		return nil, err
	}

	// set default value for time settings
	if dto.PublicDashboard.TimeSettings == nil {
		dto.PublicDashboard.TimeSettings = &TimeSettings{}
	}

	// get existing public dashboard if exists
	existingPubdash, err := pd.store.GetPublicDashboardByUid(ctx, dto.PublicDashboard.Uid)
	if err != nil {
		return nil, err
	}

	// save changes
	var pubdashUid string
	if existingPubdash == nil {
		err = validation.ValidateSavePublicDashboard(dto, dashboard)
		if err != nil {
			return nil, err
		}
		pubdashUid, err = pd.savePublicDashboardConfig(ctx, dto)
	} else {
		pubdashUid, err = pd.updatePublicDashboardConfig(ctx, dto)
	}
	if err != nil {
		return nil, err
	}

	//Get latest public dashboard to return
	newPubdash, err := pd.store.GetPublicDashboardByUid(ctx, pubdashUid)
	if err != nil {
		return nil, err
	}

	pd.logIsEnabledChanged(existingPubdash, newPubdash, u)

	return newPubdash, err
}

// Called by SavePublicDashboardConfig this handles business logic
// to generate token and calls create at the database layer
func (pd *PublicDashboardServiceImpl) savePublicDashboardConfig(ctx context.Context, dto *SavePublicDashboardConfigDTO) (string, error) {
	uid, err := pd.store.GenerateNewPublicDashboardUid(ctx)
	if err != nil {
		return "", err
	}

	accessToken, err := pd.store.GenerateNewPublicDashboardAccessToken(ctx)
	if err != nil {
		return "", err
	}

	cmd := SavePublicDashboardConfigCommand{
		PublicDashboard: PublicDashboard{
			Uid:                uid,
			DashboardUid:       dto.DashboardUid,
			OrgId:              dto.OrgId,
			IsEnabled:          dto.PublicDashboard.IsEnabled,
			AnnotationsEnabled: dto.PublicDashboard.AnnotationsEnabled,
			TimeSettings:       dto.PublicDashboard.TimeSettings,
			CreatedBy:          dto.UserId,
			CreatedAt:          time.Now(),
			AccessToken:        accessToken,
		},
	}

	err = pd.store.SavePublicDashboardConfig(ctx, cmd)
	if err != nil {
		return "", err
	}

	return uid, nil
}

// Called by SavePublicDashboard this handles business logic for updating a
// dashboard and calls update at the database layer
func (pd *PublicDashboardServiceImpl) updatePublicDashboardConfig(ctx context.Context, dto *SavePublicDashboardConfigDTO) (string, error) {
	cmd := SavePublicDashboardConfigCommand{
		PublicDashboard: PublicDashboard{
			Uid:                dto.PublicDashboard.Uid,
			IsEnabled:          dto.PublicDashboard.IsEnabled,
			AnnotationsEnabled: dto.PublicDashboard.AnnotationsEnabled,
			TimeSettings:       dto.PublicDashboard.TimeSettings,
			UpdatedBy:          dto.UserId,
			UpdatedAt:          time.Now(),
		},
	}

	return dto.PublicDashboard.Uid, pd.store.UpdatePublicDashboardConfig(ctx, cmd)
}

// Gets a list of public dashboards by orgId
func (pd *PublicDashboardServiceImpl) ListPublicDashboards(ctx context.Context, u *user.SignedInUser, orgId int64) ([]PublicDashboardListResponse, error) {
	publicDashboards, err := pd.store.ListPublicDashboards(ctx, orgId)
	if err != nil {
		return nil, err
	}

	return pd.filterDashboardsByPermissions(ctx, u, publicDashboards)
}

func (pd *PublicDashboardServiceImpl) PublicDashboardEnabled(ctx context.Context, dashboardUid string) (bool, error) {
	return pd.store.PublicDashboardEnabledExistsByDashboardUid(ctx, dashboardUid)
}

func (pd *PublicDashboardServiceImpl) PublicDashboardEnabledExistsByAccessToken(ctx context.Context, accessToken string) (bool, error) {
	return pd.store.PublicDashboardEnabledExistsByAccessToken(ctx, accessToken)
}

func (pd *PublicDashboardServiceImpl) GetPublicDashboardOrgId(ctx context.Context, accessToken string) (int64, error) {
	return pd.store.GetPublicDashboardOrgId(ctx, accessToken)
}

// intervalMS and maxQueryData values are being calculated on the frontend for regular dashboards
// we are doing the same for public dashboards but because this access would be public, we need a way to keep this
// values inside reasonable bounds to avoid an attack that could hit data sources with a small interval and a big
// time range and perform big calculations
// this is an additional validation, all data sources implements QueryData interface and should have proper validations
// of these limits
// for the maxDataPoints we took a hard limit from prometheus which is 11000
func (pd *PublicDashboardServiceImpl) getSafeIntervalAndMaxDataPoints(reqDTO PublicDashboardQueryDTO, ts TimeSettings) (int64, int64) {
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

// Log when PublicDashboard.IsEnabled changed
func (pd *PublicDashboardServiceImpl) logIsEnabledChanged(existingPubdash *PublicDashboard, newPubdash *PublicDashboard, u *user.SignedInUser) {
	if publicDashboardIsEnabledChanged(existingPubdash, newPubdash) {
		verb := "disabled"
		if newPubdash.IsEnabled {
			verb = "enabled"
		}
		pd.log.Info("Public dashboard "+verb, "publicDashboardUid", newPubdash.Uid, "dashboardUid", newPubdash.DashboardUid, "user", u.Login)
	}
}

// Filter out dashboards that user does not have read access to
func (pd *PublicDashboardServiceImpl) filterDashboardsByPermissions(ctx context.Context, u *user.SignedInUser, publicDashboards []PublicDashboardListResponse) ([]PublicDashboardListResponse, error) {
	result := make([]PublicDashboardListResponse, 0)

	for i := range publicDashboards {
		hasAccess, err := pd.ac.Evaluate(ctx, u, accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(publicDashboards[i].DashboardUid)))
		// If original dashboard does not exist, the public dashboard is an orphan. We want to list it anyway
		if err != nil && !errors.Is(err, dashboards.ErrDashboardNotFound) {
			return nil, err
		}

		// If user has access to the original dashboard or the dashboard does not exist, add the pubdash to the result
		if hasAccess || errors.Is(err, dashboards.ErrDashboardNotFound) {
			result = append(result, publicDashboards[i])
		}
	}
	return result, nil
}

// Checks to see if PublicDashboard.IsEnabled is true on create or changed on update
func publicDashboardIsEnabledChanged(existingPubdash *PublicDashboard, newPubdash *PublicDashboard) bool {
	// creating dashboard, enabled true
	newDashCreated := existingPubdash == nil && newPubdash.IsEnabled
	// updating dashboard, enabled changed
	isEnabledChanged := existingPubdash != nil && newPubdash.IsEnabled != existingPubdash.IsEnabled
	return newDashCreated || isEnabledChanged
}
