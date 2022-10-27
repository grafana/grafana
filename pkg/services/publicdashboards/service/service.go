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
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/tokens"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/util"
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

// FindDashboard Gets a dashboard by Uid
func (pd *PublicDashboardServiceImpl) FindDashboard(ctx context.Context, dashboardUid string, orgId int64) (*models.Dashboard, error) {
	dashboard, err := pd.store.FindDashboard(ctx, dashboardUid, orgId)
	if err != nil {
		return nil, err
	}

	return dashboard, nil
}

// FindPublicDashboardAndDashboardByAccessToken Gets public dashboard via access token
func (pd *PublicDashboardServiceImpl) FindPublicDashboardAndDashboardByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, *models.Dashboard, error) {
	ctxLogger := pd.log.FromContext(ctx)

	pubdash, err := pd.store.FindByAccessToken(ctx, accessToken)
	if err != nil {
		return nil, nil, err
	}

	if pubdash == nil {
		ctxLogger.Error("FindPublicDashboardAndDashboardByAccessToken: Public dashboard not found", "accessToken", accessToken)
		return nil, nil, ErrPublicDashboardNotFound
	}

	if !pubdash.IsEnabled {
		ctxLogger.Error("FindPublicDashboardAndDashboardByAccessToken: Public dashboard is disabled", "accessToken", accessToken)
		return nil, nil, ErrPublicDashboardNotFound
	}

	dash, err := pd.store.FindDashboard(ctx, pubdash.DashboardUid, pubdash.OrgId)
	if err != nil {
		return nil, nil, err
	}

	if dash == nil {
		ctxLogger.Error("FindPublicDashboardAndDashboardByAccessToken: Dashboard not found", "accessToken", accessToken)
		return nil, nil, ErrPublicDashboardNotFound
	}

	return pubdash, dash, nil
}

// FindByDashboardUid is a helper method to retrieve the public dashboard configuration for a given dashboard from the database
func (pd *PublicDashboardServiceImpl) FindByDashboardUid(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error) {
	pdc, err := pd.store.FindByDashboardUid(ctx, orgId, dashboardUid)
	if err != nil {
		return nil, err
	}

	return pdc, nil
}

// Save is a helper method to persist the sharing config
// to the database. It handles validations for sharing config and persistence
func (pd *PublicDashboardServiceImpl) Save(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardDTO) (*PublicDashboard, error) {
	// validate if the dashboard exists
	dashboard, err := pd.FindDashboard(ctx, dto.DashboardUid, u.OrgID)
	if err != nil {
		return nil, err
	}

	// set default value for time settings
	if dto.PublicDashboard.TimeSettings == nil {
		dto.PublicDashboard.TimeSettings = &TimeSettings{}
	}

	// get existing public dashboard if exists
	existingPubdash, err := pd.store.Find(ctx, dto.PublicDashboard.Uid)
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
		pubdashUid, err = pd.savePublicDashboard(ctx, dto)
	} else {
		pubdashUid, err = pd.updatePublicDashboard(ctx, dto)
	}
	if err != nil {
		return nil, err
	}

	//Get latest public dashboard to return
	newPubdash, err := pd.store.Find(ctx, pubdashUid)
	if err != nil {
		return nil, err
	}

	pd.logIsEnabledChanged(existingPubdash, newPubdash, u)

	return newPubdash, err
}

// NewPublicDashboardUid Generates a unique uid to create a public dashboard. Will make 3 attempts and fail if it cannot find an unused uid
func (pd *PublicDashboardServiceImpl) NewPublicDashboardUid(ctx context.Context) (string, error) {
	var uid string
	for i := 0; i < 3; i++ {
		uid = util.GenerateShortUID()

		pubdash, _ := pd.store.Find(ctx, uid)
		if pubdash == nil {
			return uid, nil
		}
	}
	return "", ErrPublicDashboardFailedGenerateUniqueUid
}

// NewPublicDashboardAccessToken Generates a unique accessToken to create a public dashboard. Will make 3 attempts and fail if it cannot find an unused access token
func (pd *PublicDashboardServiceImpl) NewPublicDashboardAccessToken(ctx context.Context) (string, error) {
	var accessToken string
	for i := 0; i < 3; i++ {
		var err error
		accessToken, err = tokens.GenerateAccessToken()
		if err != nil {
			continue
		}

		pubdash, _ := pd.store.FindByAccessToken(ctx, accessToken)
		if pubdash == nil {
			return accessToken, nil
		}
	}
	return "", ErrPublicDashboardFailedGenerateAccessToken
}

// Called by Save this handles business logic
// to generate token and calls create at the database layer
func (pd *PublicDashboardServiceImpl) savePublicDashboard(ctx context.Context, dto *SavePublicDashboardDTO) (string, error) {
	uid, err := pd.NewPublicDashboardUid(ctx)
	if err != nil {
		return "", err
	}

	accessToken, err := pd.NewPublicDashboardAccessToken(ctx)
	if err != nil {
		return "", err
	}

	cmd := SavePublicDashboardCommand{
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

	err = pd.store.Save(ctx, cmd)
	if err != nil {
		return "", err
	}

	return uid, nil
}

// Called by Save this handles business logic for updating a
// dashboard and calls update at the database layer
func (pd *PublicDashboardServiceImpl) updatePublicDashboard(ctx context.Context, dto *SavePublicDashboardDTO) (string, error) {
	cmd := SavePublicDashboardCommand{
		PublicDashboard: PublicDashboard{
			Uid:                dto.PublicDashboard.Uid,
			IsEnabled:          dto.PublicDashboard.IsEnabled,
			AnnotationsEnabled: dto.PublicDashboard.AnnotationsEnabled,
			TimeSettings:       dto.PublicDashboard.TimeSettings,
			UpdatedBy:          dto.UserId,
			UpdatedAt:          time.Now(),
		},
	}

	return dto.PublicDashboard.Uid, pd.store.Update(ctx, cmd)
}

// FindAll Returns a list of public dashboards by orgId
func (pd *PublicDashboardServiceImpl) FindAll(ctx context.Context, u *user.SignedInUser, orgId int64) ([]PublicDashboardListResponse, error) {
	publicDashboards, err := pd.store.FindAll(ctx, orgId)
	if err != nil {
		return nil, err
	}

	return pd.filterDashboardsByPermissions(ctx, u, publicDashboards)
}

func (pd *PublicDashboardServiceImpl) ExistsEnabledByDashboardUid(ctx context.Context, dashboardUid string) (bool, error) {
	return pd.store.ExistsEnabledByDashboardUid(ctx, dashboardUid)
}

func (pd *PublicDashboardServiceImpl) ExistsEnabledByAccessToken(ctx context.Context, accessToken string) (bool, error) {
	return pd.store.ExistsEnabledByAccessToken(ctx, accessToken)
}

func (pd *PublicDashboardServiceImpl) GetOrgIdByAccessToken(ctx context.Context, accessToken string) (int64, error) {
	return pd.store.GetOrgIdByAccessToken(ctx, accessToken)
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

// Log when PublicDashboard.ExistsEnabledByDashboardUid changed
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

// Checks to see if PublicDashboard.ExistsEnabledByDashboardUid is true on create or changed on update
func publicDashboardIsEnabledChanged(existingPubdash *PublicDashboard, newPubdash *PublicDashboard) bool {
	// creating dashboard, enabled true
	newDashCreated := existingPubdash == nil && newPubdash.IsEnabled
	// updating dashboard, enabled changed
	isEnabledChanged := existingPubdash != nil && newPubdash.IsEnabled != existingPubdash.IsEnabled
	return newDashCreated || isEnabledChanged
}
