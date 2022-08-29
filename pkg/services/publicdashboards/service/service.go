package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// Define the Service Implementation. We're generating mock implementation
// automatically
type PublicDashboardServiceImpl struct {
	log   log.Logger
	cfg   *setting.Cfg
	store publicdashboards.Store
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
) *PublicDashboardServiceImpl {
	return &PublicDashboardServiceImpl{
		log:   log.New(LogPrefix),
		cfg:   cfg,
		store: store,
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
func (pd *PublicDashboardServiceImpl) GetPublicDashboard(ctx context.Context, accessToken string) (*PublicDashboard, *models.Dashboard, error) {
	pubdash, dash, err := pd.store.GetPublicDashboard(ctx, accessToken)

	if err != nil {
		return nil, nil, err
	}

	if pubdash == nil || dash == nil {
		return nil, nil, ErrPublicDashboardNotFound
	}

	if !pubdash.IsEnabled {
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

	// get existing public dashboard if exists
	existingPubdash, err := pd.store.GetPublicDashboardByUid(ctx, dto.PublicDashboard.Uid)
	if err != nil {
		return nil, err
	}

	// save changes
	var pubdashUid string
	if existingPubdash == nil {
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

	accessToken, err := GenerateAccessToken()
	if err != nil {
		return "", err
	}

	cmd := SavePublicDashboardConfigCommand{
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
			Uid:          dto.PublicDashboard.Uid,
			IsEnabled:    dto.PublicDashboard.IsEnabled,
			TimeSettings: dto.PublicDashboard.TimeSettings,
			UpdatedBy:    dto.UserId,
			UpdatedAt:    time.Now(),
		},
	}

	return dto.PublicDashboard.Uid, pd.store.UpdatePublicDashboardConfig(ctx, cmd)
}

// BuildPublicDashboardMetricRequest merges public dashboard parameters with
// dashboard and returns a metrics request to be sent to query backend
func (pd *PublicDashboardServiceImpl) BuildPublicDashboardMetricRequest(ctx context.Context, dashboard *models.Dashboard, publicDashboard *PublicDashboard, panelId int64) (dtos.MetricRequest, error) {
	if !publicDashboard.IsEnabled {
		return dtos.MetricRequest{}, ErrPublicDashboardNotFound
	}

	queriesByPanel := models.GroupQueriesByPanelId(dashboard.Data)

	if _, ok := queriesByPanel[panelId]; !ok {
		return dtos.MetricRequest{}, ErrPublicDashboardPanelNotFound
	}

	ts := publicDashboard.BuildTimeSettings(dashboard)

	return dtos.MetricRequest{
		From:    ts.From,
		To:      ts.To,
		Queries: queriesByPanel[panelId],
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

// Log when PublicDashboard.IsEnabled changed
func (pd *PublicDashboardServiceImpl) logIsEnabledChanged(existingPubdash *PublicDashboard, newPubdash *PublicDashboard, u *user.SignedInUser) {
	if publicDashboardIsEnabledChanged(existingPubdash, newPubdash) {
		verb := "disabled"
		if newPubdash.IsEnabled {
			verb = "enabled"
		}
		pd.log.Info(fmt.Sprintf("Public dashboard %v: dashboardUid: %v, user:%v", verb, newPubdash.Uid, u.Login))
	}
}

// Checks to see if PublicDashboard.Isenabled is true on create or changed on update
func publicDashboardIsEnabledChanged(existingPubdash *PublicDashboard, newPubdash *PublicDashboard) bool {
	// creating dashboard, enabled true
	newDashCreated := existingPubdash == nil && newPubdash.IsEnabled
	// updating dashboard, enabled changed
	isEnabledChanged := existingPubdash != nil && newPubdash.IsEnabled != existingPubdash.IsEnabled
	return newDashCreated || isEnabledChanged
}
