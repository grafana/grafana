package userimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Service struct {
	store            store
	orgService       org.Service
	teamService      team.Service
	cacheService     *localcache.CacheService
	settingsProvider setting.SettingsProvider
	tracer           tracing.Tracer
	db               db.DB
}

func ProvideService(
	db db.DB,
	orgService org.Service,
	settingsProvider setting.SettingsProvider,
	teamService team.Service,
	cacheService *localcache.CacheService, tracer tracing.Tracer,
	quotaService quota.Service, bundleRegistry supportbundles.Service,
) (user.Service, error) {
	store := ProvideStore(db, settingsProvider)
	s := &Service{
		store:            &store,
		orgService:       orgService,
		settingsProvider: settingsProvider,
		teamService:      teamService,
		cacheService:     cacheService,
		tracer:           tracer,
		db:               db,
	}

	defaultLimits, err := readQuotaConfig(settingsProvider)
	if err != nil {
		return s, err
	}

	if err := quotaService.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     quota.TargetSrv(user.QuotaTargetSrv),
		DefaultLimits: defaultLimits,
		Reporter:      s.usage,
	}); err != nil {
		return s, err
	}

	bundleRegistry.RegisterSupportItemCollector(s.supportBundleCollector())
	return s, nil
}

func (s *Service) GetUsageStats(ctx context.Context) map[string]any {
	cfg := s.settingsProvider.Get()
	stats := map[string]any{}
	basicAuthStrongPasswordPolicyVal := 0
	if cfg.BasicAuthStrongPasswordPolicy {
		basicAuthStrongPasswordPolicyVal = 1
	}

	stats["stats.password_policy.count"] = basicAuthStrongPasswordPolicyVal

	count, err := s.store.CountUserAccountsWithEmptyRole(ctx)
	if err != nil {
		return nil
	}

	stats["stats.user.role_none.count"] = count

	return stats
}

func (s *Service) Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	cfg := s.settingsProvider.Get()
	ctx, span := s.tracer.Start(ctx, "user.Create")
	defer span.End()

	if len(cmd.Login) == 0 {
		cmd.Login = cmd.Email
	}

	// if login is still empty both email and login field is missing
	if len(cmd.Login) == 0 {
		return nil, user.ErrEmptyUsernameAndEmail.Errorf("user cannot be created with empty username and email")
	}

	// if the user is provisioned, use the org ID from the requester
	var orgID int64
	var err error
	if cmd.IsProvisioned {
		requester, err := identity.GetRequester(ctx)
		if err != nil {
			return nil, err
		}

		orgID = requester.GetOrgID()
	} else {
		cmdOrg := org.GetOrgIDForNewUserCommand{
			Email:        cmd.Email,
			Login:        cmd.Login,
			OrgID:        cmd.OrgID,
			OrgName:      cmd.OrgName,
			SkipOrgSetup: cmd.SkipOrgSetup,
		}
		orgID, err = s.orgService.GetIDForNewUser(ctx, cmdOrg)
		if err != nil {
			return nil, err
		}
	}
	if cmd.Email == "" {
		cmd.Email = cmd.Login
	}

	if err := s.store.LoginConflict(ctx, cmd.Login, cmd.Email); err != nil {
		return nil, user.ErrUserAlreadyExists
	}

	// create user
	usr := &user.User{
		UID:              cmd.UID,
		Email:            strings.ToLower(cmd.Email),
		Name:             cmd.Name,
		Login:            strings.ToLower(cmd.Login),
		Company:          cmd.Company,
		IsAdmin:          cmd.IsAdmin,
		IsDisabled:       cmd.IsDisabled,
		OrgID:            orgID,
		EmailVerified:    cmd.EmailVerified,
		Created:          timeNow(),
		Updated:          timeNow(),
		LastSeenAt:       timeNow().AddDate(-10, 0, 0),
		IsServiceAccount: cmd.IsServiceAccount,
		IsProvisioned:    cmd.IsProvisioned,
	}

	salt, err := util.GetRandomString(10)
	if err != nil {
		return nil, err
	}
	usr.Salt = salt
	rands, err := util.GetRandomString(10)
	if err != nil {
		return nil, err
	}
	usr.Rands = rands

	if len(cmd.Password) > 0 {
		if err := cmd.Password.Validate(s.settingsProvider); err != nil {
			return nil, err
		}

		usr.Password, err = cmd.Password.Hash(usr.Salt)
		if err != nil {
			return nil, err
		}
	}

	err = s.db.InTransaction(ctx, func(ctx context.Context) error {
		_, err = s.store.Insert(ctx, usr)
		if err != nil {
			return err
		}

		// create org user link
		if !cmd.SkipOrgSetup && !usr.IsProvisioned {
			orgUser := org.OrgUser{
				OrgID:   orgID,
				UserID:  usr.ID,
				Role:    org.RoleAdmin,
				Created: time.Now(),
				Updated: time.Now(),
			}

			if cfg.AutoAssignOrg && !usr.IsAdmin {
				if len(cmd.DefaultOrgRole) > 0 {
					orgUser.Role = org.RoleType(cmd.DefaultOrgRole)
				} else {
					orgUser.Role = org.RoleType(cfg.AutoAssignOrgRole)
				}
			}
			_, err = s.orgService.InsertOrgUser(ctx, &orgUser)
			return err
		}
		return nil
	})
	return usr, err
}

func (s *Service) Delete(ctx context.Context, cmd *user.DeleteUserCommand) error {
	ctx, span := s.tracer.Start(ctx, "user.Delete", trace.WithAttributes(
		attribute.Int64("userID", cmd.UserID),
	))
	defer span.End()

	_, err := s.store.GetByID(ctx, cmd.UserID)
	if err != nil {
		return err
	}

	return s.store.Delete(ctx, cmd.UserID)
}

func (s *Service) GetByID(ctx context.Context, query *user.GetUserByIDQuery) (*user.User, error) {
	ctx, span := s.tracer.Start(ctx, "user.GetByID", trace.WithAttributes(
		attribute.Int64("userID", query.ID),
	))
	defer span.End()

	return s.store.GetByID(ctx, query.ID)
}

func (s *Service) GetByUID(ctx context.Context, query *user.GetUserByUIDQuery) (*user.User, error) {
	ctx, span := s.tracer.Start(ctx, "user.GetByUID", trace.WithAttributes(
		attribute.String("userUID", query.UID),
	))
	defer span.End()

	return s.store.GetByUID(ctx, query.UID)
}

func (s *Service) ListByIdOrUID(ctx context.Context, uids []string, ids []int64) ([]*user.User, error) {
	if len(uids) == 0 && len(ids) == 0 {
		return []*user.User{}, nil
	}
	ctx, span := s.tracer.Start(ctx, "user.ListByIdOrUID", trace.WithAttributes(
		attribute.StringSlice("userUIDs", uids),
		attribute.Int64Slice("userIDs", ids),
	))
	defer span.End()

	return s.store.ListByIdOrUID(ctx, uids, ids)
}

func (s *Service) GetByLogin(ctx context.Context, query *user.GetUserByLoginQuery) (*user.User, error) {
	ctx, span := s.tracer.Start(ctx, "user.GetByLogin")
	defer span.End()

	return s.store.GetByLogin(ctx, query)
}

func (s *Service) GetByEmail(ctx context.Context, query *user.GetUserByEmailQuery) (*user.User, error) {
	ctx, span := s.tracer.Start(ctx, "user.GetByEmail")
	defer span.End()

	return s.store.GetByEmail(ctx, query)
}

func (s *Service) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	ctx, span := s.tracer.Start(ctx, "user.Update", trace.WithAttributes(
		attribute.Int64("userID", cmd.UserID),
	))
	defer span.End()

	usr, err := s.store.GetByID(ctx, cmd.UserID)
	if err != nil {
		return err
	}

	if cmd.OldPassword != nil {
		old, err := cmd.OldPassword.Hash(usr.Salt)
		if err != nil {
			return err
		}

		if old != usr.Password {
			return user.ErrPasswordMissmatch.Errorf("old password does not match stored password")
		}
	}

	if cmd.Password != nil {
		if err := cmd.Password.Validate(s.settingsProvider); err != nil {
			return err
		}

		hashed, err := cmd.Password.Hash(usr.Salt)
		if err != nil {
			return err
		}
		cmd.Password = &hashed
	}

	if cmd.OrgID != nil {
		orgs, err := s.orgService.GetUserOrgList(ctx, &org.GetUserOrgListQuery{UserID: cmd.UserID})
		if err != nil {
			return err
		}

		valid := false
		for _, org := range orgs {
			if org.OrgID == *cmd.OrgID {
				valid = true
			}
		}

		if !valid {
			return fmt.Errorf("user does not belong to org")
		}
	}

	return s.store.Update(ctx, cmd)
}

func (s *Service) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	ctx, span := s.tracer.Start(ctx, "user.UpdateLastSeen", trace.WithAttributes(
		attribute.Int64("userID", cmd.UserID),
	))
	defer span.End()

	u, err := s.GetSignedInUser(ctx, &user.GetSignedInUserQuery{
		UserID: cmd.UserID,
		OrgID:  cmd.OrgID,
	})
	if err != nil {
		return err
	}

	if !s.shouldUpdateLastSeen(u.LastSeenAt) {
		return user.ErrLastSeenUpToDate
	}

	return s.store.UpdateLastSeenAt(ctx, cmd)
}

func (s *Service) shouldUpdateLastSeen(t time.Time) bool {
	cfg := s.settingsProvider.Get()
	return time.Since(t) > cfg.UserLastSeenUpdateInterval
}

func (s *Service) GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	ctx, span := s.tracer.Start(ctx, "user.GetSignedInUser", trace.WithAttributes(
		attribute.Int64("userID", query.UserID),
		attribute.Int64("orgID", query.OrgID),
	))
	defer span.End()

	var signedInUser *user.SignedInUser

	// only check cache if we have a user ID and an org ID in query
	if s.cacheService != nil {
		if query.OrgID > 0 && query.UserID > 0 {
			cacheKey := newSignedInUserCacheKey(query.OrgID, query.UserID)
			if cached, found := s.cacheService.Get(cacheKey); found {
				cachedUser := cached.(user.SignedInUser)
				signedInUser = &cachedUser
				return signedInUser, nil
			}
		}
	}

	result, err := s.getSignedInUser(ctx, query)
	if err != nil {
		return nil, err
	}

	if s.cacheService != nil {
		cacheKey := newSignedInUserCacheKey(result.OrgID, result.UserID)
		s.cacheService.Set(cacheKey, *result, time.Second*5)
	}

	return result, nil
}

func newSignedInUserCacheKey(orgID, userID int64) string {
	return fmt.Sprintf("signed-in-user-%d-%d", userID, orgID)
}

func (s *Service) getSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	ctx, span := s.tracer.Start(ctx, "user.getSignedInUser", trace.WithAttributes(
		attribute.Int64("userID", query.UserID),
		attribute.Int64("orgID", query.OrgID),
	))
	defer span.End()

	usr, err := s.store.GetSignedInUser(ctx, query)
	if err != nil {
		return nil, err
	}

	usr.Teams, err = s.teamService.GetTeamIDsByUser(ctx, &team.GetTeamIDsByUserQuery{
		OrgID:  usr.OrgID,
		UserID: usr.UserID,
	})
	if err != nil {
		return nil, err
	}

	return usr, err
}

func (s *Service) Search(ctx context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	ctx, span := s.tracer.Start(ctx, "user.Search", trace.WithAttributes(
		attribute.Int64("orgID", query.OrgID),
	))
	defer span.End()

	return s.store.Search(ctx, query)
}

func (s *Service) BatchDisableUsers(ctx context.Context, cmd *user.BatchDisableUsersCommand) error {
	ctx, span := s.tracer.Start(ctx, "user.BatchDisableUsers", trace.WithAttributes(
		attribute.Int64Slice("userIDs", cmd.UserIDs),
	))
	defer span.End()

	return s.store.BatchDisableUsers(ctx, cmd)
}

func (s *Service) GetProfile(ctx context.Context, query *user.GetUserProfileQuery) (*user.UserProfileDTO, error) {
	ctx, span := s.tracer.Start(ctx, "user.GetProfile", trace.WithAttributes(
		attribute.Int64("userID", query.UserID),
	))
	defer span.End()

	return s.store.GetProfile(ctx, query)
}

// CreateServiceAccount creates a service account in the user table and adds service account to an organisation in the org_user table
func (s *Service) CreateServiceAccount(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	ctx, span := s.tracer.Start(ctx, "user.CreateServiceAccount", trace.WithAttributes(
		attribute.Int64("orgID", cmd.OrgID),
	))
	defer span.End()

	cmd.Email = cmd.Login
	err := s.store.LoginConflict(ctx, cmd.Login, cmd.Email)
	if err != nil {
		return nil, serviceaccounts.ErrServiceAccountAlreadyExists.Errorf("service account with login %s already exists", cmd.Login)
	}

	// create user
	usr := &user.User{
		Email:            cmd.Email,
		Name:             cmd.Name,
		Login:            cmd.Login,
		IsDisabled:       cmd.IsDisabled,
		OrgID:            cmd.OrgID,
		Created:          time.Now(),
		Updated:          time.Now(),
		LastSeenAt:       time.Now().AddDate(-10, 0, 0),
		IsServiceAccount: true,
	}

	salt, err := util.GetRandomString(10)
	if err != nil {
		return nil, err
	}
	usr.Salt = salt
	rands, err := util.GetRandomString(10)
	if err != nil {
		return nil, err
	}
	usr.Rands = rands

	_, err = s.store.Insert(ctx, usr)
	if err != nil {
		return nil, err
	}

	// create org user link
	orgCmd := &org.AddOrgUserCommand{
		OrgID:                     cmd.OrgID,
		UserID:                    usr.ID,
		Role:                      org.RoleType(cmd.DefaultOrgRole),
		AllowAddingServiceAccount: true,
	}
	if err = s.orgService.AddOrgUser(ctx, orgCmd); err != nil {
		return nil, err
	}

	return usr, nil
}

func (s *Service) supportBundleCollector() supportbundles.Collector {
	collectorFn := func(ctx context.Context) (*supportbundles.SupportItem, error) {
		query := &user.SearchUsersQuery{
			SignedInUser: &user.SignedInUser{
				Login:            "sa-supportbundle",
				OrgRole:          "Admin",
				IsGrafanaAdmin:   true,
				IsServiceAccount: true,
				Permissions:      map[int64]map[string][]string{ac.GlobalOrgID: {ac.ActionUsersRead: {ac.ScopeGlobalUsersAll}}},
			},
			OrgID:      0,
			Query:      "",
			Page:       0,
			Limit:      0,
			AuthModule: "",
			Filters:    []user.Filter{},
			IsDisabled: new(bool),
		}
		res, err := s.Search(ctx, query)
		if err != nil {
			return nil, err
		}

		userBytes, err := json.MarshalIndent(res.Users, "", " ")
		if err != nil {
			return nil, err
		}

		return &supportbundles.SupportItem{
			Filename:  "users.json",
			FileBytes: userBytes,
		}, nil
	}

	return supportbundles.Collector{
		UID:               "users",
		DisplayName:       "User information",
		Description:       "List users belonging to the Grafana instance",
		IncludedByDefault: false,
		Default:           false,
		Fn:                collectorFn,
	}
}

func (s *Service) usage(ctx context.Context, _ *quota.ScopeParameters) (*quota.Map, error) {
	u := &quota.Map{}
	if used, err := s.store.Count(ctx); err != nil {
		return u, err
	} else {
		tag, err := quota.NewTag(quota.TargetSrv(user.QuotaTargetSrv), quota.Target(user.QuotaTarget), quota.GlobalScope)
		if err != nil {
			return u, err
		}
		u.Set(tag, used)
	}
	return u, nil
}

func readQuotaConfig(settingsProvider setting.SettingsProvider) (*quota.Map, error) {
	limits := &quota.Map{}

	cfg := settingsProvider.Get()
	if cfg == nil {
		return limits, nil
	}

	globalQuotaTag, err := quota.NewTag(quota.TargetSrv(user.QuotaTargetSrv), quota.Target(user.QuotaTarget), quota.GlobalScope)
	if err != nil {
		return limits, err
	}

	limits.Set(globalQuotaTag, cfg.Quota.Global.User)
	return limits, nil
}
