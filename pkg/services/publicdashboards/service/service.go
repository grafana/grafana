package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
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
	serviceWrapper     publicdashboards.ServiceWrapper
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
	serviceWrapper publicdashboards.ServiceWrapper,
) *PublicDashboardServiceImpl {
	return &PublicDashboardServiceImpl{
		log:                log.New(LogPrefix),
		cfg:                cfg,
		store:              store,
		intervalCalculator: intervalv2.NewCalculator(),
		QueryDataService:   qds,
		AnnotationsRepo:    anno,
		ac:                 ac,
		serviceWrapper:     serviceWrapper,
	}
}

// FindByDashboardUid this method would be replaced by another implementation for Enterprise version
func (pd *PublicDashboardServiceImpl) FindByDashboardUid(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error) {
	return pd.serviceWrapper.FindByDashboardUid(ctx, orgId, dashboardUid)
}

func (pd *PublicDashboardServiceImpl) Find(ctx context.Context, uid string) (*PublicDashboard, error) {
	pubdash, err := pd.store.Find(ctx, uid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Find: failed to find public dashboard%w", err)
	}
	return pubdash, nil
}

// FindDashboard Gets a dashboard by Uid
func (pd *PublicDashboardServiceImpl) FindDashboard(ctx context.Context, orgId int64, dashboardUid string) (*dashboards.Dashboard, error) {
	dash, err := pd.store.FindDashboard(ctx, orgId, dashboardUid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("FindDashboard: failed to find dashboard by orgId: %d and dashboardUid: %s: %w", orgId, dashboardUid, err)
	}

	if dash == nil {
		return nil, ErrDashboardNotFound.Errorf("FindDashboard: dashboard not found by orgId: %d and dashboardUid: %s", orgId, dashboardUid)
	}

	return dash, nil
}

// FindByAccessToken Gets public dashboard by access token
func (pd *PublicDashboardServiceImpl) FindByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, error) {
	pubdash, err := pd.store.FindByAccessToken(ctx, accessToken)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("FindByAccessToken: failed to find a public dashboard: %w", err)
	}

	if pubdash == nil {
		return nil, ErrPublicDashboardNotFound.Errorf("FindByAccessToken: Public dashboard not found accessToken: %s", accessToken)
	}

	return pubdash, nil
}

// FindEnabledPublicDashboardAndDashboardByAccessToken Gets public dashboard and a dashboard by access token if public dashboard is enabled
func (pd *PublicDashboardServiceImpl) FindEnabledPublicDashboardAndDashboardByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, *dashboards.Dashboard, error) {
	pubdash, dash, err := pd.FindPublicDashboardAndDashboardByAccessToken(ctx, accessToken)
	if err != nil {
		return pubdash, dash, err
	}

	if !pubdash.IsEnabled {
		return nil, nil, ErrPublicDashboardNotEnabled.Errorf("FindEnabledPublicDashboardAndDashboardByAccessToken: Public dashboard is not enabled accessToken: %s", accessToken)
	}

	return pubdash, dash, err
}

// FindPublicDashboardAndDashboardByAccessToken Gets public dashboard and a dashboard by access token
func (pd *PublicDashboardServiceImpl) FindPublicDashboardAndDashboardByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, *dashboards.Dashboard, error) {
	pubdash, err := pd.FindByAccessToken(ctx, accessToken)
	if err != nil {
		return nil, nil, err
	}

	dash, err := pd.store.FindDashboard(ctx, pubdash.OrgId, pubdash.DashboardUid)
	if err != nil {
		return nil, nil, err
	}

	if dash == nil {
		return nil, nil, ErrPublicDashboardNotFound.Errorf("FindPublicDashboardAndDashboardByAccessToken: Dashboard not found accessToken: %s", accessToken)
	}

	return pubdash, dash, nil
}

// Creates and validates the public dashboard and saves it to the database
func (pd *PublicDashboardServiceImpl) Create(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardDTO) (*PublicDashboard, error) {
	// validate fields
	err := validation.ValidatePublicDashboard(dto)
	if err != nil {
		return nil, err
	}

	// ensure dashboard exists
	_, err = pd.FindDashboard(ctx, u.OrgID, dto.DashboardUid)
	if err != nil {
		return nil, err
	}

	// verify public dashboard does not exist and that we didn't get one from the
	// request
	existingPubdash, err := pd.store.Find(ctx, dto.PublicDashboard.Uid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Create: failed to find the public dashboard: %w", err)
	} else if existingPubdash != nil {
		return nil, ErrBadRequest.Errorf("Create: public dashboard already exists: %s", dto.PublicDashboard.Uid)
	}

	// set default value for time settings
	if dto.PublicDashboard.TimeSettings == nil {
		dto.PublicDashboard.TimeSettings = &TimeSettings{}
	}

	if dto.PublicDashboard.Share == "" {
		dto.PublicDashboard.Share = PublicShareType
	}

	uid, err := pd.NewPublicDashboardUid(ctx)
	if err != nil {
		return nil, err
	}

	accessToken, err := pd.NewPublicDashboardAccessToken(ctx)
	if err != nil {
		return nil, err
	}

	cmd := SavePublicDashboardCommand{
		PublicDashboard: PublicDashboard{
			Uid:                  uid,
			DashboardUid:         dto.DashboardUid,
			OrgId:                dto.OrgId,
			IsEnabled:            dto.PublicDashboard.IsEnabled,
			AnnotationsEnabled:   dto.PublicDashboard.AnnotationsEnabled,
			TimeSelectionEnabled: dto.PublicDashboard.TimeSelectionEnabled,
			TimeSettings:         dto.PublicDashboard.TimeSettings,
			Share:                dto.PublicDashboard.Share,
			CreatedBy:            dto.UserId,
			CreatedAt:            time.Now(),
			AccessToken:          accessToken,
		},
	}

	affectedRows, err := pd.store.Create(ctx, cmd)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Create: failed to create the public dashboard with Uid %s: %w", uid, err)
	} else if affectedRows == 0 {
		return nil, ErrInternalServerError.Errorf("Create: failed to create a database entry for public dashboard with Uid %s. 0 rows changed, no error reported.", uid)
	}

	//Get latest public dashboard to return
	newPubdash, err := pd.store.Find(ctx, uid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Create: failed to find the public dashboard: %w", err)
	}

	pd.logIsEnabledChanged(existingPubdash, newPubdash, u)

	return newPubdash, err
}

// Update: updates an existing public dashboard based on publicdashboard.Uid
func (pd *PublicDashboardServiceImpl) Update(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardDTO) (*PublicDashboard, error) {
	// validate fields
	err := validation.ValidatePublicDashboard(dto)
	if err != nil {
		return nil, err
	}

	// validate if the dashboard exists
	dashboard, err := pd.FindDashboard(ctx, u.OrgID, dto.DashboardUid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Update: failed to find dashboard by orgId: %d and dashboardUid: %s: %w", u.OrgID, dto.DashboardUid, err)
	}

	if dashboard == nil {
		return nil, ErrDashboardNotFound.Errorf("Update: dashboard not found by orgId: %d and dashboardUid: %s", u.OrgID, dto.DashboardUid)
	}

	// get existing public dashboard if exists
	existingPubdash, err := pd.store.Find(ctx, dto.PublicDashboard.Uid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Update: failed to find public dashboard by uid: %s: %w", dto.PublicDashboard.Uid, err)
	} else if existingPubdash == nil {
		return nil, ErrPublicDashboardNotFound.Errorf("Update: public dashboard not found by uid: %s", dto.PublicDashboard.Uid)
	}

	// set default value for time settings
	if dto.PublicDashboard.TimeSettings == nil {
		dto.PublicDashboard.TimeSettings = &TimeSettings{}
	}

	if dto.PublicDashboard.Share == "" {
		dto.PublicDashboard.Share = existingPubdash.Share
	}

	// set values to update
	cmd := SavePublicDashboardCommand{
		PublicDashboard: PublicDashboard{
			Uid:                  existingPubdash.Uid,
			IsEnabled:            dto.PublicDashboard.IsEnabled,
			AnnotationsEnabled:   dto.PublicDashboard.AnnotationsEnabled,
			TimeSelectionEnabled: dto.PublicDashboard.TimeSelectionEnabled,
			TimeSettings:         dto.PublicDashboard.TimeSettings,
			Share:                dto.PublicDashboard.Share,
			UpdatedBy:            dto.UserId,
			UpdatedAt:            time.Now(),
		},
	}

	// persist
	affectedRows, err := pd.store.Update(ctx, cmd)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Update: failed to update public dashboard: %w", err)
	}

	// 404 if not found
	if affectedRows == 0 {
		return nil, ErrPublicDashboardNotFound.Errorf("Update: failed to update public dashboard not found by uid: %s", dto.PublicDashboard.Uid)
	}

	// get latest public dashboard to return
	newPubdash, err := pd.store.Find(ctx, existingPubdash.Uid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Update: failed to find public dashboard by uid: %s: %w", existingPubdash.Uid, err)
	}

	pd.logIsEnabledChanged(existingPubdash, newPubdash, u)

	return newPubdash, nil
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
	return "", ErrInternalServerError.Errorf("failed to generate a unique uid for public dashboard")
}

// NewPublicDashboardAccessToken Generates a unique accessToken to create a public dashboard. Will make 3 attempts and fail if it cannot find an unused access token
func (pd *PublicDashboardServiceImpl) NewPublicDashboardAccessToken(ctx context.Context) (string, error) {
	var accessToken string
	for i := 0; i < 3; i++ {
		var err error
		accessToken, err = GenerateAccessToken()
		if err != nil {
			continue
		}

		pubdash, _ := pd.store.FindByAccessToken(ctx, accessToken)
		if pubdash == nil {
			return accessToken, nil
		}
	}
	return "", ErrInternalServerError.Errorf("failed to generate a unique accesssToken for public dashboard")
}

// FindAll Returns a list of public dashboards by orgId
func (pd *PublicDashboardServiceImpl) FindAll(ctx context.Context, u *user.SignedInUser, orgId int64) ([]PublicDashboardListResponse, error) {
	publicDashboards, err := pd.store.FindAll(ctx, orgId)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("FindAll: %w", err)
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

func (pd *PublicDashboardServiceImpl) Delete(ctx context.Context, uid string) error {
	return pd.serviceWrapper.Delete(ctx, uid)
}

func (pd *PublicDashboardServiceImpl) DeleteByDashboard(ctx context.Context, dashboard *dashboards.Dashboard) error {
	if dashboard.IsFolder {
		// get all pubdashes for the folder
		pubdashes, err := pd.store.FindByDashboardFolder(ctx, dashboard)
		if err != nil {
			return err
		}
		// delete each pubdash
		for _, pubdash := range pubdashes {
			err = pd.serviceWrapper.Delete(ctx, pubdash.Uid)
			if err != nil {
				return err
			}
		}

		return nil
	}

	pubdash, err := pd.store.FindByDashboardUid(ctx, dashboard.OrgID, dashboard.UID)
	if err != nil {
		return ErrInternalServerError.Errorf("DeleteByDashboard: error finding a public dashboard by dashboard orgId: %d and Uid: %s %w", dashboard.OrgID, dashboard.UID, err)
	}
	if pubdash == nil {
		return nil
	}

	return pd.serviceWrapper.Delete(ctx, pubdash.Uid)
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
			return nil, ErrInternalServerError.Errorf("filterDashboardsByPermissions: error evaluating permissions %w", err)
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

// GenerateAccessToken generates an uuid formatted without dashes to use as access token
func GenerateAccessToken() (string, error) {
	token, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", token[:]), nil
}
