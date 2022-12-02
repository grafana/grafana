package userimpl

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
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
	return s, nil
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
	usr := &user.User{
		Login: cmd.Login,
		Email: cmd.Email,
	}
	usr, err = s.store.Get(ctx, usr)
	if err != nil && !errors.Is(err, user.ErrUserNotFound) {
		return usr, err
	}

	// create user
	usr = &user.User{
		Email:            cmd.Email,
		Name:             cmd.Name,
		Login:            cmd.Login,
		Company:          cmd.Company,
		IsAdmin:          cmd.IsAdmin,
		IsDisabled:       cmd.IsDisabled,
		OrgID:            cmd.OrgID,
		EmailVerified:    cmd.EmailVerified,
		Created:          time.Now(),
		Updated:          time.Now(),
		LastSeenAt:       time.Now().AddDate(-10, 0, 0),
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
		encodedPassword, err := util.EncodePassword(cmd.Password, usr.Salt)
		if err != nil {
			return nil, err
		}
		usr.Password = encodedPassword
	}

	userID, err := s.store.Insert(ctx, usr)
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

		if setting.AutoAssignOrg && !usr.IsAdmin {
			if len(cmd.DefaultOrgRole) > 0 {
				orgUser.Role = org.RoleType(cmd.DefaultOrgRole)
			} else {
				orgUser.Role = org.RoleType(setting.AutoAssignOrgRole)
			}
		}
		_, err = s.orgService.InsertOrgUser(ctx, &orgUser)
		if err != nil {
			err := s.store.Delete(ctx, userID)
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
	return s.store.Update(ctx, cmd)
}

func (s *Service) ChangePassword(ctx context.Context, cmd *user.ChangeUserPasswordCommand) error {
	return s.store.ChangePassword(ctx, cmd)
}

func (s *Service) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	return s.store.UpdateLastSeenAt(ctx, cmd)
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

	// tempUser is used to retrieve the teams for the signed in user for internal use.
	tempUser := &user.SignedInUser{
		OrgID: signedInUser.OrgID,
		Permissions: map[int64]map[string][]string{
			signedInUser.OrgID: {
				ac.ActionTeamsRead: {ac.ScopeTeamsAll},
			},
		},
	}
	getTeamsByUserQuery := &models.GetTeamsByUserQuery{
		OrgId:        signedInUser.OrgID,
		UserId:       signedInUser.UserID,
		SignedInUser: tempUser,
	}
	err = s.teamService.GetTeamsByUser(ctx, getTeamsByUserQuery)
	if err != nil {
		return nil, err
	}

	signedInUser.Teams = make([]int64, len(getTeamsByUserQuery.Result))
	for i, t := range getTeamsByUserQuery.Result {
		signedInUser.Teams[i] = t.Id
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

// CreateUserForTests creates a test user and optionally an organization. Unlike
// Create, `cmd.SkipOrgSetup` toggles whether or not to create an org for the
// test user if there isn't already an existing org. This must only be used in tests.
func (s *Service) CreateUserForTests(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	var usr user.User
	var orgID int64 = -1
	if !args.SkipOrgSetup {
		var err error
		orgID, err = ss.getOrgIDForNewUser(sess, args)
		if err != nil {
			return usr, err
		}
	}

}

func (s *Service) getOrCreateOrgForTestUser(ctx context.Context, cmd *user.CreateUserCommand) (*org.Org, error) {
	// First see if a matching organization already exists
	fmt.Printf("getOrCreate: cmd.OrgID = %d\n", cmd.OrgID)
	foundOrg, err := s.orgService.GetByID(ctx, &org.GetOrgByIdQuery{ID: cmd.OrgID})
	if err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			fmt.Println("org not found")
			// this is fine, we'll create the org in the next step
		} else {
			return nil, err
		}
	} else {
		// Easy case, nothing to do!
		fmt.Println("found org, all good!")
		return foundOrg, nil
	}

	// If we're here, we need to create a new org for the (test) user.
	orgName := cmd.OrgName
	if orgName == "" {
		orgName = util.StringsFallback2(cmd.Email, cmd.Login)
	}
	fmt.Printf("orgName: %s\n", orgName)

	org, err := s.orgService.GetOrCreate(ctx, orgName)

	if err != nil {
		return nil, err
	} else {
		return org, nil
	}
}
