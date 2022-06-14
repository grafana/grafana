package searchV2

import (
	"context"
	"errors"

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
	dashboardIndex *dashboardIndex
	extender       DashboardIndexExtender
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
		dashboardIndex: newDashboardIndex(
			newSQLDashboardLoader(sql),
			entityEventStore,
			extender.GetDocumentExtender(),
			newFolderIDLookup(sql),
		),
		logger:   log.New("searchV2"),
		extender: extender,
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
	return s.dashboardIndex.run(ctx)
}

func (s *StandardSearchService) RegisterDashboardIndexExtender(ext DashboardIndexExtender) {
	s.extender = ext
	s.dashboardIndex.extender = ext.GetDocumentExtender()
}

func (s *StandardSearchService) getUser(ctx context.Context, backendUser *backend.User, orgId int64) (*models.SignedInUser, error) {
	// TODO: get user & user's permissions from the request context

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

	user := getSignedInUserQuery.Result

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

	reader, ok := s.dashboardIndex.getOrgReader(orgID)
	if !ok {
		// For non-main organization indexes are built lazily.
		// If we don't have an index then we are blocking here until an index for
		// an organization is ready. This actually takes time only during the first
		// access, all the consequent search requests do not fall into this branch.
		doneIndexing := make(chan error, 1)
		signal := buildSignal{orgID: orgID, done: doneIndexing}
		select {
		case s.dashboardIndex.buildSignals <- signal:
		case <-ctx.Done():
			rsp.Error = ctx.Err()
			return rsp
		}
		select {
		case err := <-doneIndexing:
			if err != nil {
				rsp.Error = err
				return rsp
			}
		case <-ctx.Done():
			rsp.Error = ctx.Err()
			return rsp
		}
		reader, _ = s.dashboardIndex.getOrgReader(orgID)
	}

	return doSearchQuery(ctx, s.logger, reader, filter, q, s.extender.GetQueryExtender(q), s.cfg.AppSubURL)
}
