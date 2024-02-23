package userimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Service struct {
	store        store
	orgService   org.Service
	teamService  team.Service
	cacheService *localcache.CacheService
	cfg          *setting.Cfg
}

func ProvideService(
	db db.DB,
	orgService org.Service,
	cfg *setting.Cfg,
	teamService team.Service,
	cacheService *localcache.CacheService,
	quotaService quota.Service,
	bundleRegistry supportbundles.Service,
) (user.Service, error) {
	store := ProvideStore(db, cfg)
	s := &Service{
		store:        &store,
		orgService:   orgService,
		cfg:          cfg,
		teamService:  teamService,
		cacheService: cacheService,
	}

	defaultLimits, err := readQuotaConfig(cfg)
	if err != nil {
		return s, err
	}

	if err := quotaService.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     quota.TargetSrv(user.QuotaTargetSrv),
		DefaultLimits: defaultLimits,
		Reporter:      s.Usage,
	}); err != nil {
		return s, err
	}

	if err := s.uidMigration(db); err != nil {
		return nil, err
	}

	bundleRegistry.RegisterSupportItemCollector(s.supportBundleCollector())
	return s, nil
}

func (s *Service) GetUsageStats(ctx context.Context) map[string]any {
	stats := map[string]any{}
	caseInsensitiveLoginVal := 0
	basicAuthStrongPasswordPolicyVal := 0
	if s.cfg.CaseInsensitiveLogin {
		caseInsensitiveLoginVal = 1
	}
	if s.cfg.BasicAuthStrongPasswordPolicy {
		basicAuthStrongPasswordPolicyVal = 1
	}

	stats["stats.case_insensitive_login.count"] = caseInsensitiveLoginVal
	stats["stats.password_policy.count"] = basicAuthStrongPasswordPolicyVal

	count, err := s.store.CountUserAccountsWithEmptyRole(ctx)
	if err != nil {
		return nil
	}

	stats["stats.user.role_none.count"] = count

	return stats
}

func (s *Service) Usage(ctx context.Context, _ *quota.ScopeParameters) (*quota.Map, error) {
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

func (s *Service) Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	if len(cmd.Login) == 0 {
		cmd.Login = cmd.Email
	}

	// if login is still empty both email and login field is missing
	if len(cmd.Login) == 0 {
		return nil, user.ErrEmptyUsernameAndEmail.Errorf("user cannot be created with empty username and email")
	}

	cmdOrg := org.GetOrgIDForNewUserCommand{
		Email:        cmd.Email,
		Login:        cmd.Login,
		OrgID:        cmd.OrgID,
		OrgName:      cmd.OrgName,
		SkipOrgSetup: cmd.SkipOrgSetup,
	}
	orgID, err := s.orgService.GetIDForNewUser(ctx, cmdOrg)
	if err != nil {
		return nil, err
	}
	if cmd.Email == "" {
		cmd.Email = cmd.Login
	}

	err = s.store.LoginConflict(ctx, cmd.Login, cmd.Email, s.cfg.CaseInsensitiveLogin)
	if err != nil {
		return nil, user.ErrUserAlreadyExists
	}

	// create user
	usr := &user.User{
		UID:              cmd.UID,
		Email:            cmd.Email,
		Name:             cmd.Name,
		Login:            cmd.Login,
		Company:          cmd.Company,
		IsAdmin:          cmd.IsAdmin,
		IsDisabled:       cmd.IsDisabled,
		OrgID:            orgID,
		EmailVerified:    cmd.EmailVerified,
		Created:          timeNow(),
		Updated:          timeNow(),
		LastSeenAt:       timeNow().AddDate(-10, 0, 0),
		IsServiceAccount: cmd.IsServiceAccount,
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
		encodedPassword, err := util.EncodePassword(string(cmd.Password), usr.Salt)
		if err != nil {
			return nil, err
		}
		usr.Password = user.Password(encodedPassword)
	}

	_, err = s.store.Insert(ctx, usr)
	if err != nil {
		return nil, err
	}

	// create org user link
	if !cmd.SkipOrgSetup {
		orgUser := org.OrgUser{
			OrgID:   orgID,
			UserID:  usr.ID,
			Role:    org.RoleAdmin,
			Created: time.Now(),
			Updated: time.Now(),
		}

		if s.cfg.AutoAssignOrg && !usr.IsAdmin {
			if len(cmd.DefaultOrgRole) > 0 {
				orgUser.Role = org.RoleType(cmd.DefaultOrgRole)
			} else {
				orgUser.Role = org.RoleType(s.cfg.AutoAssignOrgRole)
			}
		}
		_, err = s.orgService.InsertOrgUser(ctx, &orgUser)
		if err != nil {
			err := s.store.Delete(ctx, usr.ID)
			return usr, err
		}
	}
	return usr, nil
}

func (s *Service) Delete(ctx context.Context, cmd *user.DeleteUserCommand) error {
	_, err := s.store.GetNotServiceAccount(ctx, cmd.UserID)
	if err != nil {
		return err
	}
	// delete from all the stores
	return s.store.Delete(ctx, cmd.UserID)
}

func (s *Service) GetByID(ctx context.Context, query *user.GetUserByIDQuery) (*user.User, error) {
	user, err := s.store.GetByID(ctx, query.ID)
	if err != nil {
		return nil, err
	}
	if s.cfg.CaseInsensitiveLogin {
		if err := s.store.CaseInsensitiveLoginConflict(ctx, user.Login, user.Email); err != nil {
			return nil, err
		}
	}
	return user, nil
}

func (s *Service) GetByLogin(ctx context.Context, query *user.GetUserByLoginQuery) (*user.User, error) {
	return s.store.GetByLogin(ctx, query)
}

func (s *Service) GetByEmail(ctx context.Context, query *user.GetUserByEmailQuery) (*user.User, error) {
	return s.store.GetByEmail(ctx, query)
}

func (s *Service) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	if s.cfg.CaseInsensitiveLogin {
		cmd.Login = strings.ToLower(cmd.Login)
		cmd.Email = strings.ToLower(cmd.Email)
	}

	return s.store.Update(ctx, cmd)
}

func (s *Service) ChangePassword(ctx context.Context, cmd *user.ChangeUserPasswordCommand) error {
	return s.store.ChangePassword(ctx, cmd)
}

func (s *Service) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	u, err := s.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{
		UserID: cmd.UserID,
		OrgID:  cmd.OrgID,
	})

	if err != nil {
		return err
	}

	if !shouldUpdateLastSeen(u.LastSeenAt) {
		return user.ErrLastSeenUpToDate
	}

	return s.store.UpdateLastSeenAt(ctx, cmd)
}

func shouldUpdateLastSeen(t time.Time) bool {
	return time.Since(t) > time.Minute*5
}

func (s *Service) SetUsingOrg(ctx context.Context, cmd *user.SetUsingOrgCommand) error {
	getOrgsForUserCmd := &org.GetUserOrgListQuery{UserID: cmd.UserID}
	orgsForUser, err := s.orgService.GetUserOrgList(ctx, getOrgsForUserCmd)
	if err != nil {
		return err
	}

	valid := false
	for _, other := range orgsForUser {
		if other.OrgID == cmd.OrgID {
			valid = true
		}
	}
	if !valid {
		return fmt.Errorf("user does not belong to org")
	}
	return s.store.UpdateUser(ctx, &user.User{
		ID:    cmd.UserID,
		OrgID: cmd.OrgID,
	})
}

func (s *Service) GetSignedInUserWithCacheCtx(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	var signedInUser *user.SignedInUser

	// only check cache if we have a user ID and an org ID in query
	if query.OrgID > 0 && query.UserID > 0 {
		cacheKey := newSignedInUserCacheKey(query.OrgID, query.UserID)
		if cached, found := s.cacheService.Get(cacheKey); found {
			cachedUser := cached.(user.SignedInUser)
			signedInUser = &cachedUser
			return signedInUser, nil
		}
	}

	result, err := s.GetSignedInUser(ctx, query)
	if err != nil {
		return nil, err
	}

	cacheKey := newSignedInUserCacheKey(result.OrgID, result.UserID)
	s.cacheService.Set(cacheKey, *result, time.Second*5)
	return result, nil
}

func newSignedInUserCacheKey(orgID, userID int64) string {
	return fmt.Sprintf("signed-in-user-%d-%d", userID, orgID)
}

func (s *Service) GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	signedInUser, err := s.store.GetSignedInUser(ctx, query)
	if err != nil {
		return nil, err
	}

	getTeamsByUserQuery := &team.GetTeamIDsByUserQuery{
		OrgID:  signedInUser.OrgID,
		UserID: signedInUser.UserID,
	}
	signedInUser.Teams, err = s.teamService.GetTeamIDsByUser(ctx, getTeamsByUserQuery)
	if err != nil {
		return nil, err
	}

	return signedInUser, err
}

func (s *Service) NewAnonymousSignedInUser(ctx context.Context) (*user.SignedInUser, error) {
	if !s.cfg.AnonymousEnabled {
		return nil, fmt.Errorf("anonymous access is disabled")
	}

	usr := &user.SignedInUser{
		IsAnonymous: true,
		OrgRole:     roletype.RoleType(s.cfg.AnonymousOrgRole),
	}

	if s.cfg.AnonymousOrgName == "" {
		return usr, nil
	}

	getOrg := org.GetOrgByNameQuery{Name: s.cfg.AnonymousOrgName}
	anonymousOrg, err := s.orgService.GetByName(ctx, &getOrg)
	if err != nil {
		return nil, err
	}

	usr.OrgID = anonymousOrg.ID
	usr.OrgName = anonymousOrg.Name
	return usr, nil
}

func (s *Service) Search(ctx context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	return s.store.Search(ctx, query)
}

func (s *Service) Disable(ctx context.Context, cmd *user.DisableUserCommand) error {
	return s.store.Disable(ctx, cmd)
}

func (s *Service) BatchDisableUsers(ctx context.Context, cmd *user.BatchDisableUsersCommand) error {
	return s.store.BatchDisableUsers(ctx, cmd)
}

func (s *Service) UpdatePermissions(ctx context.Context, userID int64, isAdmin bool) error {
	return s.store.UpdatePermissions(ctx, userID, isAdmin)
}

func (s *Service) SetUserHelpFlag(ctx context.Context, cmd *user.SetUserHelpFlagCommand) error {
	return s.store.SetHelpFlag(ctx, cmd)
}

func (s *Service) GetProfile(ctx context.Context, query *user.GetUserProfileQuery) (*user.UserProfileDTO, error) {
	result, err := s.store.GetProfile(ctx, query)
	return result, err
}

func readQuotaConfig(cfg *setting.Cfg) (*quota.Map, error) {
	limits := &quota.Map{}

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

// CreateServiceAccount creates a service account in the user table and adds service account to an organisation in the org_user table
func (s *Service) CreateServiceAccount(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	cmd.Email = cmd.Login
	err := s.store.LoginConflict(ctx, cmd.Login, cmd.Email, s.cfg.CaseInsensitiveLogin)
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

// This is just to ensure that all users have a valid uid.
// To protect against upgrade / downgrade we need to run this for a couple of releases.
// FIXME: Remove this migration and make uid field required https://github.com/grafana/identity-access-team/issues/552
func (s *Service) uidMigration(store db.DB) error {
	return store.WithDbSession(context.Background(), func(sess *db.Session) error {
		switch store.GetDBType() {
		case migrator.SQLite:
			_, err := sess.Exec("UPDATE user SET uid=printf('u%09d',id) WHERE uid IS NULL;")
			return err
		case migrator.Postgres:
			_, err := sess.Exec("UPDATE `user` SET uid='u' || lpad('' || id::text,9,'0') WHERE uid IS NULL;")
			return err
		case migrator.MySQL:
			_, err := sess.Exec("UPDATE user SET uid=concat('u',lpad(id,9,'0')) WHERE uid IS NULL;")
			return err
		default:
			// this branch should be unreachable
			return nil
		}
	})
}
