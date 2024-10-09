package unifiedSearch

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type StandardSearchService struct {
	registry.BackgroundService
	cfg            *setting.Cfg
	sql            db.DB
	ac             accesscontrol.Service
	orgService     org.Service
	userService    user.Service
	logger         log.Logger
	reIndexCh      chan struct{}
	features       featuremgmt.FeatureToggles
	resourceClient resource.ResourceClient
}

func (s *StandardSearchService) IsReady(ctx context.Context, orgId int64) IsSearchReadyResponse {
	return IsSearchReadyResponse{IsReady: true}
}

func ProvideService(cfg *setting.Cfg, sql db.DB, entityEventStore store.EntityEventsService,
	ac accesscontrol.Service, tracer tracing.Tracer, features featuremgmt.FeatureToggles, orgService org.Service,
	userService user.Service, folderStore folder.Store, resourceClient resource.ResourceClient) SearchService {
	logger := log.New("searchV3")
	s := &StandardSearchService{
		cfg:            cfg,
		sql:            sql,
		ac:             ac,
		logger:         logger,
		reIndexCh:      make(chan struct{}, 1),
		orgService:     orgService,
		userService:    userService,
		features:       features,
		resourceClient: resourceClient,
	}
	return s
}

func (s *StandardSearchService) IsDisabled() bool {
	return !s.features.IsEnabledGlobally(featuremgmt.FlagPanelTitleSearch)
}

func (s *StandardSearchService) Run(ctx context.Context) error {
	// TODO: implement this? ( copied from pkg/services/searchV2/service.go )
	// orgQuery := &org.SearchOrgsQuery{}
	// result, err := s.orgService.Search(ctx, orgQuery)
	// if err != nil {
	// 	return fmt.Errorf("can't get org list: %w", err)
	// }
	// orgIDs := make([]int64, 0, len(result))
	// for _, org := range result {
	// 	orgIDs = append(orgIDs, org.ID)
	// }
	// TODO: do we need to initialize the bleve index again ( should be initialized on startup )?
	// return s.dashboardIndex.run(ctx, orgIDs, s.reIndexCh)
	return nil
}

func (s *StandardSearchService) TriggerReIndex() {
	select {
	case s.reIndexCh <- struct{}{}:
	default:
		// channel is full => re-index will happen soon anyway.
	}
}

func (s *StandardSearchService) getUser(ctx context.Context, backendUser *backend.User, orgId int64) (*user.SignedInUser, error) {
	// TODO: get user & user's permissions from the request context
	var usr *user.SignedInUser
	if s.cfg.AnonymousEnabled && backendUser.Email == "" && backendUser.Login == "" {
		getOrg := org.GetOrgByNameQuery{Name: s.cfg.AnonymousOrgName}
		orga, err := s.orgService.GetByName(ctx, &getOrg)
		if err != nil {
			s.logger.Error("Anonymous access organization error.", "org_name", s.cfg.AnonymousOrgName, "error", err)
			return nil, err
		}

		usr = &user.SignedInUser{
			OrgID:       orga.ID,
			OrgName:     orga.Name,
			OrgRole:     org.RoleType(s.cfg.AnonymousOrgRole),
			IsAnonymous: true,
		}
	} else {
		getSignedInUserQuery := &user.GetSignedInUserQuery{
			Login: backendUser.Login,
			Email: backendUser.Email,
			OrgID: orgId,
		}
		var err error
		usr, err = s.userService.GetSignedInUser(ctx, getSignedInUserQuery)
		if err != nil {
			s.logger.Error("Error while retrieving user", "error", err, "email", backendUser.Email, "login", getSignedInUserQuery.Login)
			return nil, errors.New("auth error")
		}

		if usr == nil {
			s.logger.Error("No user found", "email", backendUser.Email)
			return nil, errors.New("auth error")
		}
	}

	if usr.Permissions == nil {
		usr.Permissions = make(map[int64]map[string][]string)
	}

	if _, ok := usr.Permissions[orgId]; ok {
		// permissions as part of the `s.sql.GetSignedInUser` query - return early
		return usr, nil
	}

	// TODO: ensure this is cached
	permissions, err := s.ac.GetUserPermissions(ctx, usr,
		accesscontrol.Options{ReloadCache: false})
	if err != nil {
		s.logger.Error("Failed to retrieve user permissions", "error", err, "email", backendUser.Email)
		return nil, errors.New("auth error")
	}

	usr.Permissions[orgId] = accesscontrol.GroupScopesByActionContext(ctx, permissions)
	return usr, nil
}

func (s *StandardSearchService) DoQuery(ctx context.Context, user *backend.User, orgID int64, q Query) *backend.DataResponse {
	signedInUser, err := s.getUser(ctx, user, orgID)
	if err != nil {
		return &backend.DataResponse{Error: err}
	}

	query := s.doQuery(ctx, signedInUser, orgID, q)
	return query
}

func (s *StandardSearchService) doQuery(ctx context.Context, signedInUser *user.SignedInUser, orgID int64, q Query) *backend.DataResponse {
	response := s.doSearchQuery(ctx, q, s.cfg.AppSubURL)
	return response
}

func (s *StandardSearchService) doSearchQuery(ctx context.Context, qry Query, _ string) *backend.DataResponse {
	response := &backend.DataResponse{}

	req := &resource.SearchRequest{Tenant: s.cfg.StackID, Query: qry.Query, Limit: int64(qry.Limit), Offset: int64(qry.From)}
	res, err := s.resourceClient.Search(ctx, req)
	if err != nil {
		s.logger.Error("Failed to search resources", "error", err)
		response.Error = err
		return response
	}

	// TODO: implement this correctly
	frame := data.NewFrame("results", data.NewField("value", nil, []string{}))
	frame.Meta = &data.FrameMeta{Notices: []data.Notice{{Text: "TODO"}}}
	for _, r := range res.Items {
		frame.AppendRow(string(r.Value))
	}
	response.Frames = append(response.Frames, frame)
	return response
}
