package searchV2

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type StandardSearchService struct {
	registry.BackgroundService

	cfg  *setting.Cfg
	sql  *sqlstore.SQLStore
	auth FutureAuthService // eventually injected from elsewhere
	ac   accesscontrol.AccessControl

	logger         log.Logger
	dashboardIndex *searchIndex
	extender       DashboardIndexExtender
	reIndexCh      chan struct{}
}

func ProvideService(cfg *setting.Cfg, sql *sqlstore.SQLStore, entityEventStore store.EntityEventsService, ac accesscontrol.AccessControl) SearchService {
	extender := &NoopExtender{}
	s := &StandardSearchService{
		cfg: cfg,
		sql: sql,
		ac:  ac,
		auth: &simpleSQLAuthService{
			sql: sql,
			ac:  ac,
		},
		dashboardIndex: newSearchIndex(
			newSQLDashboardLoader(sql),
			entityEventStore,
			extender.GetDocumentExtender(),
			newFolderIDLookup(sql),
		),
		logger:    log.New("searchV2"),
		extender:  extender,
		reIndexCh: make(chan struct{}, 1),
	}
	return s
}

func (s *StandardSearchService) IsDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.IsFeatureToggleEnabled(featuremgmt.FlagPanelTitleSearch)
}

func (s *StandardSearchService) Run(ctx context.Context) error {
	orgQuery := &models.SearchOrgsQuery{}
	err := s.sql.SearchOrgs(ctx, orgQuery)
	if err != nil {
		return fmt.Errorf("can't get org list: %w", err)
	}
	orgIDs := make([]int64, 0, len(orgQuery.Result))
	for _, org := range orgQuery.Result {
		orgIDs = append(orgIDs, org.Id)
	}
	return s.dashboardIndex.run(ctx, orgIDs, s.reIndexCh)
}

func (s *StandardSearchService) TriggerReIndex() {
	select {
	case s.reIndexCh <- struct{}{}:
	default:
		// channel is full => re-index will happen soon anyway.
	}
}

func (s *StandardSearchService) RegisterDashboardIndexExtender(ext DashboardIndexExtender) {
	s.extender = ext
	s.dashboardIndex.extender = ext.GetDocumentExtender()
}

func (s *StandardSearchService) getUser(ctx context.Context, backendUser *backend.User, orgId int64) (*models.SignedInUser, error) {
	// TODO: get user & user's permissions from the request context

	var user *models.SignedInUser
	if s.cfg.AnonymousEnabled && backendUser.Email == "" && backendUser.Login == "" {
		org, err := s.sql.GetOrgByName(s.cfg.AnonymousOrgName)
		if err != nil {
			s.logger.Error("Anonymous access organization error.", "org_name", s.cfg.AnonymousOrgName, "error", err)
			return nil, err
		}

		user = &models.SignedInUser{
			OrgId:       org.Id,
			OrgName:     org.Name,
			OrgRole:     models.RoleType(s.cfg.AnonymousOrgRole),
			IsAnonymous: true,
		}
	} else {
		getSignedInUserQuery := &models.GetSignedInUserQuery{
			Login: backendUser.Login,
			Email: backendUser.Email,
			OrgId: orgId,
		}
		err := s.sql.GetSignedInUser(ctx, getSignedInUserQuery)
		if err != nil {
			s.logger.Error("Error while retrieving user", "error", err, "email", backendUser.Email)
			return nil, errors.New("auth error")
		}

		if getSignedInUserQuery.Result == nil {
			s.logger.Error("No user found", "email", backendUser.Email)
			return nil, errors.New("auth error")
		}

		user = getSignedInUserQuery.Result
	}

	if s.ac.IsDisabled() {
		return user, nil
	}

	if user.Permissions == nil {
		user.Permissions = make(map[int64]map[string][]string)
	}

	if _, ok := user.Permissions[orgId]; ok {
		// permissions as part of the `s.sql.GetSignedInUser` query - return early
		return user, nil
	}

	// TODO: ensure this is cached
	permissions, err := s.ac.GetUserPermissions(ctx, user,
		accesscontrol.Options{ReloadCache: false})
	if err != nil {
		s.logger.Error("failed to retrieve user permissions", "error", err, "email", backendUser.Email)
		return nil, errors.New("auth error")
	}

	user.Permissions[orgId] = accesscontrol.GroupScopesByAction(permissions)
	return user, nil
}

func (s *StandardSearchService) DoDashboardQuery(ctx context.Context, user *backend.User, orgID int64, q DashboardQuery) *backend.DataResponse {
	rsp := &backend.DataResponse{}
	signedInUser, err := s.getUser(ctx, user, orgID)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	filter, err := s.auth.GetDashboardReadFilter(signedInUser)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	index, err := s.dashboardIndex.getOrCreateOrgIndex(ctx, orgID)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	err = s.dashboardIndex.sync(ctx)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	response := doSearchQuery(ctx, s.logger, index, filter, q, s.extender.GetQueryExtender(q), s.cfg.AppSubURL)

	if q.WithAllowedActions {
		if err := s.addAllowedActionsField(ctx, orgID, signedInUser, response); err != nil {
			s.logger.Error("error when adding the allowedActions field", "err", err)
		}
	}

	return response
}
