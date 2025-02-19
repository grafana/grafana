package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/service/intervalv2"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// PublicDashboardServiceImpl Define the Service Implementation. We're generating mock implementation
// automatically
type PublicDashboardServiceImpl struct {
	log                log.Logger
	cfg                *setting.Cfg
	features           featuremgmt.FeatureToggles
	store              publicdashboards.Store
	intervalCalculator intervalv2.Calculator
	QueryDataService   query.Service
	AnnotationsRepo    annotations.Repository
	ac                 accesscontrol.AccessControl
	serviceWrapper     publicdashboards.ServiceWrapper
	dashboardService   dashboards.DashboardService
	license            licensing.Licensing
}

var LogPrefix = "publicdashboards.service"
var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/publicdashboards/service")

// Gives us compile time error if the service does not adhere to the contract of
// the interface
var _ publicdashboards.Service = (*PublicDashboardServiceImpl)(nil)

// ProvideService Factory for method used by wire to inject dependencies.
// builds the service, and api, and configures routes
func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	store publicdashboards.Store,
	qds query.Service,
	anno annotations.Repository,
	ac accesscontrol.AccessControl,
	serviceWrapper publicdashboards.ServiceWrapper,
	dashboardService dashboards.DashboardService,
	license licensing.Licensing,
) *PublicDashboardServiceImpl {
	return &PublicDashboardServiceImpl{
		log:                log.New(LogPrefix),
		cfg:                cfg,
		features:           features,
		store:              store,
		intervalCalculator: intervalv2.NewCalculator(),
		QueryDataService:   qds,
		AnnotationsRepo:    anno,
		ac:                 ac,
		serviceWrapper:     serviceWrapper,
		dashboardService:   dashboardService,
		license:            license,
	}
}

func (pd *PublicDashboardServiceImpl) GetPublicDashboardForView(ctx context.Context, accessToken string) (*dtos.DashboardFullWithMeta, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.GetPublicDashboardForView")
	defer span.End()

	pubdash, dash, err := pd.FindEnabledPublicDashboardAndDashboardByAccessToken(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.PublicDashboards).Inc()
	meta := dtos.DashboardMeta{
		Slug:                   dash.Slug,
		Type:                   dashboards.DashTypeDB,
		CanStar:                false,
		CanSave:                false,
		CanEdit:                false,
		CanAdmin:               false,
		CanDelete:              false,
		Created:                dash.Created,
		Updated:                dash.Updated,
		Version:                dash.Version,
		IsFolder:               false,
		FolderId:               dash.FolderID, // nolint:staticcheck
		FolderUid:              dash.FolderUID,
		PublicDashboardEnabled: pubdash.IsEnabled,
	}
	dash.Data.Get("timepicker").Set("hidden", !pubdash.TimeSelectionEnabled)

	sanitizeData(dash.Data)

	return &dtos.DashboardFullWithMeta{Meta: meta, Dashboard: dash.Data}, nil
}

// FindByDashboardUid this method would be replaced by another implementation for Enterprise version
func (pd *PublicDashboardServiceImpl) FindByDashboardUid(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.FindByDashboardUid")
	defer span.End()
	return pd.serviceWrapper.FindByDashboardUid(ctx, orgId, dashboardUid)
}

func (pd *PublicDashboardServiceImpl) Find(ctx context.Context, uid string) (*PublicDashboard, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.Find")
	defer span.End()
	pubdash, err := pd.store.Find(ctx, uid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Find: failed to find public dashboard%w", err)
	}
	return pubdash, nil
}

// FindDashboard Gets a dashboard by Uid
func (pd *PublicDashboardServiceImpl) FindDashboard(ctx context.Context, orgId int64, dashboardUid string) (*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.FindDashboard")
	defer span.End()

	// We don't have a signed in user for public dashboards. We are using Grafana's Identity to query the dashboard.
	dash, err := identity.WithServiceIdentityFn(ctx, orgId, func(ctx context.Context) (*dashboards.Dashboard, error) {
		return pd.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{UID: dashboardUid, OrgID: orgId})
	})
	if err != nil {
		var dashboardErr dashboards.DashboardErr
		if ok := errors.As(err, &dashboardErr); ok {
			if dashboardErr.StatusCode == 404 {
				return nil, ErrDashboardNotFound.Errorf("FindDashboard: dashboard not found by orgId: %d and dashboardUid: %s", orgId, dashboardUid)
			}
		}
		return nil, ErrInternalServerError.Errorf("FindDashboard: failed to find dashboard by orgId: %d and dashboardUid: %s: %w", orgId, dashboardUid, err)
	}

	return dash, nil
}

// FindByAccessToken Gets public dashboard by access token
func (pd *PublicDashboardServiceImpl) FindByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.FindByAccessToken")
	defer span.End()
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
	ctx, span := tracer.Start(ctx, "publicdashboards.FindEnabledPublicDashboardAndDashboardByAccessToken")
	defer span.End()
	pubdash, dash, err := pd.FindPublicDashboardAndDashboardByAccessToken(ctx, accessToken)
	if err != nil {
		return pubdash, dash, err
	}

	if !pubdash.IsEnabled {
		return nil, nil, ErrPublicDashboardNotEnabled.Errorf("FindEnabledPublicDashboardAndDashboardByAccessToken: Public dashboard is not enabled accessToken: %s", accessToken)
	}

	if !pd.license.FeatureEnabled(FeaturePublicDashboardsEmailSharing) && pubdash.Share == EmailShareType {
		return nil, nil, ErrPublicDashboardNotFound.Errorf("FindEnabledPublicDashboardAndDashboardByAccessToken: Dashboard not found accessToken: %s", accessToken)
	}

	return pubdash, dash, err
}

// FindPublicDashboardAndDashboardByAccessToken Gets public dashboard and a dashboard by access token
func (pd *PublicDashboardServiceImpl) FindPublicDashboardAndDashboardByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, *dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.FindPublicDashboardAndDashboardByAccessToken")
	defer span.End()
	pubdash, err := pd.FindByAccessToken(ctx, accessToken)
	if err != nil {
		return nil, nil, err
	}

	dash, err := pd.FindDashboard(ctx, pubdash.OrgId, pubdash.DashboardUid)
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
	ctx, span := tracer.Start(ctx, "publicdashboards.Create")
	defer span.End()
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

	// validate the dashboard does not already have a public dashboard
	existingPubdash, err := pd.FindByDashboardUid(ctx, u.OrgID, dto.DashboardUid)
	if err != nil && !errors.Is(err, ErrPublicDashboardNotFound) {
		return nil, err
	}

	if existingPubdash != nil {
		// If there is no license and the public dashboard was email-shared, we should update it to public
		if !pd.license.FeatureEnabled(FeaturePublicDashboardsEmailSharing) && existingPubdash.Share == EmailShareType {
			dto.Uid = existingPubdash.Uid
			dto.PublicDashboard.Share = PublicShareType
			return pd.Update(ctx, u, dto)
		}
		return nil, ErrDashboardIsPublic.Errorf("Create: public dashboard for dashboard %s already exists", dto.DashboardUid)
	}

	publicDashboard, err := pd.newCreatePublicDashboard(ctx, dto)
	if err != nil {
		return nil, err
	}

	cmd := SavePublicDashboardCommand{
		PublicDashboard: *publicDashboard,
	}

	affectedRows, err := pd.store.Create(ctx, cmd)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Create: failed to create the public dashboard with Uid %s: %w", publicDashboard.Uid, err)
	} else if affectedRows == 0 {
		return nil, ErrInternalServerError.Errorf("Create: failed to create a database entry for public dashboard with Uid %s. 0 rows changed, no error reported.", publicDashboard.Uid)
	}

	//Get latest public dashboard to return
	newPubdash, err := pd.store.Find(ctx, publicDashboard.Uid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Create: failed to find the public dashboard: %w", err)
	}

	pd.logIsEnabledChanged(existingPubdash, newPubdash, u)

	return newPubdash, err
}

// Update: updates an existing public dashboard based on publicdashboard.Uid
func (pd *PublicDashboardServiceImpl) Update(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardDTO) (*PublicDashboard, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.Update")
	defer span.End()
	// validate fields
	err := validation.ValidatePublicDashboard(dto)
	if err != nil {
		return nil, err
	}

	// validate dashboard exists
	_, err = pd.FindDashboard(ctx, u.OrgID, dto.DashboardUid)
	if err != nil {
		return nil, err
	}

	// get existing public dashboard if exists
	existingPubdash, err := pd.store.Find(ctx, dto.Uid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Update: failed to find public dashboard by uid: %s: %w", dto.Uid, err)
	} else if existingPubdash == nil {
		return nil, ErrPublicDashboardNotFound.Errorf("Update: public dashboard not found by uid: %s", dto.Uid)
	}

	// validate the public dashboard belongs to the dashboard
	if existingPubdash.DashboardUid != dto.DashboardUid {
		return nil, ErrInvalidUid.Errorf("Update: the public dashboard does not belong to the dashboard")
	}

	publicDashboard := newUpdatePublicDashboard(dto, existingPubdash)

	// set values to update
	cmd := SavePublicDashboardCommand{
		PublicDashboard: *publicDashboard,
	}

	// persist
	affectedRows, err := pd.store.Update(ctx, cmd)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("Update: failed to update public dashboard: %w", err)
	}

	// 404 if not found
	if affectedRows == 0 {
		return nil, ErrPublicDashboardNotFound.Errorf("Update: failed to update public dashboard not found by uid: %s", dto.Uid)
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
	ctx, span := tracer.Start(ctx, "publicdashboards.NewPublicDashboardUid")
	defer span.End()
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
	ctx, span := tracer.Start(ctx, "publicdashboards.NewPublicDashboardAccessToken")
	defer span.End()
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
	return "", ErrInternalServerError.Errorf("failed to generate a unique accessToken for public dashboard")
}

// FindAllWithPagination Returns a list of public dashboards by orgId, based on permissions and with pagination
func (pd *PublicDashboardServiceImpl) FindAllWithPagination(ctx context.Context, query *PublicDashboardListQuery) (*PublicDashboardListResponseWithPagination, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.FindAllWithPagination")
	defer span.End()
	query.Offset = query.Limit * (query.Page - 1)
	resp, err := pd.store.FindAll(ctx, query)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("FindAllWithPagination: GetPublicDashboards: %w", err)
	}

	// join in the dashboard data
	dashUIDs := make([]string, len(resp.PublicDashboards))
	for i, pubdash := range resp.PublicDashboards {
		dashUIDs[i] = pubdash.DashboardUid
	}

	dashboardsFound, err := pd.dashboardService.FindDashboards(ctx, &dashboards.FindPersistedDashboardsQuery{
		OrgId:         query.OrgID,
		DashboardUIDs: dashUIDs,
		SignedInUser:  query.User,
		Limit:         int64(len(dashUIDs)),
		Type:          searchstore.TypeDashboard,
	})
	if err != nil {
		return nil, ErrInternalServerError.Errorf("FindAllWithPagination: GetDashboards: %w", err)
	}

	dashMap := make(map[string]dashboards.DashboardSearchProjection)
	for _, dash := range dashboardsFound {
		dashMap[dash.UID] = dash
	}

	// add dashboard title & slug to response, and
	// remove any public dashboards that don't have a corresponding active dashboard that the user has access to
	idx := 0
	for _, pubdash := range resp.PublicDashboards {
		if dash, exists := dashMap[pubdash.DashboardUid]; exists {
			pubdash.Title = dash.Title
			pubdash.Slug = dash.Slug
			resp.PublicDashboards[idx] = pubdash
			idx++
		} else {
			resp.TotalCount--
		}
	}
	resp.PublicDashboards = resp.PublicDashboards[:idx]

	//  sort by title
	sort.Slice(resp.PublicDashboards, func(i, j int) bool {
		return resp.PublicDashboards[i].Title < resp.PublicDashboards[j].Title
	})

	// and now paginate
	start := query.Offset
	end := start + query.Limit
	if start > len(resp.PublicDashboards) {
		start = len(resp.PublicDashboards)
	}
	if end > len(resp.PublicDashboards) {
		end = len(resp.PublicDashboards)
	}
	resp.PublicDashboards = resp.PublicDashboards[start:end]

	resp.Page = query.Page
	resp.PerPage = query.Limit

	return resp, nil
}

func (pd *PublicDashboardServiceImpl) ExistsEnabledByDashboardUid(ctx context.Context, dashboardUid string) (bool, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.ExistsEnabledByDashboardUid")
	defer span.End()
	return pd.store.ExistsEnabledByDashboardUid(ctx, dashboardUid)
}

func (pd *PublicDashboardServiceImpl) ExistsEnabledByAccessToken(ctx context.Context, accessToken string) (bool, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.ExistsEnabledByAccessToken")
	defer span.End()
	return pd.store.ExistsEnabledByAccessToken(ctx, accessToken)
}

func (pd *PublicDashboardServiceImpl) GetOrgIdByAccessToken(ctx context.Context, accessToken string) (int64, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.GetOrgIdByAccessToken")
	defer span.End()
	return pd.store.GetOrgIdByAccessToken(ctx, accessToken)
}

func (pd *PublicDashboardServiceImpl) Delete(ctx context.Context, uid string, dashboardUid string) error {
	ctx, span := tracer.Start(ctx, "publicdashboards.Delete")
	defer span.End()
	// get existing public dashboard if exists
	existingPubdash, err := pd.store.Find(ctx, uid)
	if err != nil {
		return ErrInternalServerError.Errorf("Delete: failed to find public dashboard by uid: %s: %w", uid, err)
	}
	if existingPubdash == nil {
		return ErrPublicDashboardNotFound.Errorf("Delete: public dashboard not found by uid: %s", uid)
	}

	// validate the public dashboard belongs to the dashboard
	if existingPubdash.DashboardUid != dashboardUid {
		return ErrInvalidUid.Errorf("Delete: the public dashboard does not belong to the dashboard")
	}
	return pd.serviceWrapper.Delete(ctx, uid)
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
	dataTimeRange := gtime.NewTimeRange(ts.From, ts.To)
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

func (pd *PublicDashboardServiceImpl) newCreatePublicDashboard(ctx context.Context, dto *SavePublicDashboardDTO) (*PublicDashboard, error) {
	ctx, span := tracer.Start(ctx, "publicdashboards.newCreatePublicDashboard")
	defer span.End()
	//Check if uid already exists, if none then auto generate
	var err error
	uid := dto.PublicDashboard.Uid

	if uid != "" {
		existingPubdash, _ := pd.store.Find(ctx, uid)
		if existingPubdash != nil {
			return nil, ErrPublicDashboardUidExists.Errorf("Create: public dashboard uid %s already exists", uid)
		}
	} else {
		uid, err = pd.NewPublicDashboardUid(ctx)
		if err != nil {
			return nil, err
		}
	}

	//Check if accessToken already exists, if none then auto generate
	accessToken := dto.PublicDashboard.AccessToken
	if accessToken != "" {
		existingPubdash, _ := pd.store.FindByAccessToken(ctx, accessToken)
		if existingPubdash != nil {
			return nil, ErrPublicDashboardAccessTokenExists.Errorf("Create: public dashboard access token %s already exists", accessToken)
		}
	} else {
		accessToken, err = pd.NewPublicDashboardAccessToken(ctx)
		if err != nil {
			return nil, err
		}
	}

	isEnabled := returnValueOrDefault(dto.PublicDashboard.IsEnabled, false)
	annotationsEnabled := returnValueOrDefault(dto.PublicDashboard.AnnotationsEnabled, false)
	timeSelectionEnabled := returnValueOrDefault(dto.PublicDashboard.TimeSelectionEnabled, false)

	share := dto.PublicDashboard.Share
	if dto.PublicDashboard.Share == "" {
		share = PublicShareType
	}

	now := time.Now()

	return &PublicDashboard{
		Uid:                  uid,
		DashboardUid:         dto.DashboardUid,
		OrgId:                dto.OrgID,
		IsEnabled:            isEnabled,
		AnnotationsEnabled:   annotationsEnabled,
		TimeSelectionEnabled: timeSelectionEnabled,
		TimeSettings:         &TimeSettings{},
		Share:                share,
		CreatedBy:            dto.UserId,
		CreatedAt:            now,
		UpdatedBy:            dto.UserId,
		UpdatedAt:            now,
		AccessToken:          accessToken,
	}, nil
}

func newUpdatePublicDashboard(dto *SavePublicDashboardDTO, pd *PublicDashboard) *PublicDashboard {
	pubdashDTO := dto.PublicDashboard
	timeSelectionEnabled := returnValueOrDefault(pubdashDTO.TimeSelectionEnabled, pd.TimeSelectionEnabled)
	isEnabled := returnValueOrDefault(pubdashDTO.IsEnabled, pd.IsEnabled)
	annotationsEnabled := returnValueOrDefault(pubdashDTO.AnnotationsEnabled, pd.AnnotationsEnabled)

	share := pubdashDTO.Share
	if pubdashDTO.Share == "" {
		share = pd.Share
	}

	return &PublicDashboard{
		Uid:                  pd.Uid,
		IsEnabled:            isEnabled,
		AnnotationsEnabled:   annotationsEnabled,
		TimeSelectionEnabled: timeSelectionEnabled,
		TimeSettings:         pd.TimeSettings,
		Share:                share,
		UpdatedBy:            dto.UserId,
		UpdatedAt:            time.Now(),
	}
}

func returnValueOrDefault(value *bool, defaultValue bool) bool {
	if value != nil {
		return *value
	}

	return defaultValue
}
