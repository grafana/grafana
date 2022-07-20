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
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/setting"
)

// Define the Service Implementation. We're generating mock implementation
// automatically
type PublicDashboardServiceImpl struct {
	log   log.Logger
	cfg   *setting.Cfg
	store publicdashboards.Store
}

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
		log:   log.New("publicdashboards"),
		cfg:   cfg,
		store: store,
	}
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
	if len(dto.DashboardUid) == 0 {
		return nil, dashboards.ErrDashboardIdentifierNotSet
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
func (pd *PublicDashboardServiceImpl) BuildAnonymousUser(ctx context.Context, dashboard *models.Dashboard) (*models.SignedInUser, error) {
	datasourceUids := models.GetUniqueDashboardDatasourceUids(dashboard.Data)

	// Create a temp user with read-only datasource permissions
	anonymousUser := &models.SignedInUser{OrgId: dashboard.OrgId, Permissions: make(map[int64]map[string][]string)}
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

// generates a uuid formatted without dashes to use as access token
func GenerateAccessToken() (string, error) {
	token, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", token[:]), nil
}
