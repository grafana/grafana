package sync

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errUserSignupDisabled = errutil.NewBase(
		errutil.StatusUnauthorized,
		"user.sync.signup-disabled",
		errutil.WithPublicMessage("Sign up is disabled"),
	)
	errSyncUserForbidden = errutil.NewBase(
		errutil.StatusForbidden,
		"user.sync.forbidden",
		errutil.WithPublicMessage("User sync forbidden"),
	)
	errSyncUserInternal = errutil.NewBase(
		errutil.StatusInternal,
		"user.sync.internal",
		errutil.WithPublicMessage("User sync failed"),
	)
	errUserProtection = errutil.NewBase(
		errutil.StatusForbidden,
		"user.sync.protected-role",
		errutil.WithPublicMessage("Unable to sync due to protected role"),
	)
	errFetchingSignedInUser = errutil.NewBase(
		errutil.StatusInternal,
		"user.sync.fetch",
		errutil.WithPublicMessage("Insufficient information to authenticate user"),
	)
)

func ProvideUserSync(userService user.Service,
	userProtectionService login.UserProtectionService,
	authInfoService login.AuthInfoService, quotaService quota.Service) *UserSync {
	return &UserSync{
		userService:           userService,
		authInfoService:       authInfoService,
		userProtectionService: userProtectionService,
		quotaService:          quotaService,
		log:                   log.New("user.sync"),
	}
}

type UserSync struct {
	userService           user.Service
	authInfoService       login.AuthInfoService
	userProtectionService login.UserProtectionService
	quotaService          quota.Service
	log                   log.Logger
}

// SyncUserHook syncs a user with the database
func (s *UserSync) SyncUserHook(ctx context.Context, id *authn.Identity, _ *authn.Request) error {
	if !id.ClientParams.SyncUser {
		return nil
	}

	// Does user exist in the database?
	usr, userAuth, errUserInDB := s.getUser(ctx, id)
	if errUserInDB != nil && !errors.Is(errUserInDB, user.ErrUserNotFound) {
		s.log.FromContext(ctx).Error("Failed to fetch user", "error", errUserInDB, "auth_module", id.AuthModule, "auth_id", id.AuthID)
		return errSyncUserInternal.Errorf("unable to retrieve user")
	}

	if errors.Is(errUserInDB, user.ErrUserNotFound) {
		if !id.ClientParams.AllowSignUp {
			s.log.FromContext(ctx).Warn("Failed to create user, signup is not allowed for module", "auth_module", id.AuthModule, "auth_id", id.AuthID)
			return errUserSignupDisabled.Errorf("%w", login.ErrSignupNotAllowed)
		}

		// create user
		var errCreate error
		usr, errCreate = s.createUser(ctx, id)
		if errCreate != nil {
			s.log.FromContext(ctx).Error("Failed to create user", "error", errCreate, "auth_module", id.AuthModule, "auth_id", id.AuthID)
			return errSyncUserInternal.Errorf("unable to create user")
		}
	} else {
		// update user
		if errUpdate := s.updateUserAttributes(ctx, usr, id, userAuth); errUpdate != nil {
			s.log.FromContext(ctx).Error("Failed to update user", "error", errUpdate, "auth_module", id.AuthModule, "auth_id", id.AuthID)
			return errSyncUserInternal.Errorf("unable to update user")
		}
	}

	syncUserToIdentity(usr, id)
	return nil
}

func (s *UserSync) FetchSyncedUserHook(ctx context.Context, identity *authn.Identity, r *authn.Request) error {
	if !identity.ClientParams.FetchSyncedUser {
		return nil
	}
	namespace, id := identity.NamespacedID()
	if namespace != authn.NamespaceUser {
		return nil
	}

	usr, err := s.userService.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{
		UserID: id,
		OrgID:  r.OrgID,
	})
	if err != nil {
		return errFetchingSignedInUser.Errorf("failed to resolve user: %w", err)
	}

	syncSignedInUserToIdentity(usr, identity)
	return nil
}

func (s *UserSync) SyncLastSeenHook(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	namespace, id := identity.NamespacedID()

	if namespace != authn.NamespaceUser && namespace != authn.NamespaceServiceAccount {
		// skip sync
		return nil
	}

	if !shouldUpdateLastSeen(identity.LastSeenAt) {
		return nil
	}

	go func(userID int64) {
		defer func() {
			if err := recover(); err != nil {
				s.log.Error("Panic during user last seen sync", "err", err)
			}
		}()

		if err := s.userService.UpdateLastSeenAt(context.Background(), &user.UpdateUserLastSeenAtCommand{UserID: userID}); err != nil {
			s.log.Error("Failed to update last_seen_at", "err", err, "userId", userID)
		}
	}(id)

	return nil
}

func (s *UserSync) EnableDisabledUserHook(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	if !identity.ClientParams.EnableDisabledUsers {
		return nil
	}

	if !identity.IsDisabled {
		return nil
	}

	namespace, id := identity.NamespacedID()
	if namespace != authn.NamespaceUser {
		return nil
	}

	return s.userService.Disable(ctx, &user.DisableUserCommand{UserID: id, IsDisabled: false})
}

func (s *UserSync) upsertAuthConnection(ctx context.Context, userID int64, identity *authn.Identity, createConnection bool) error {
	if identity.AuthModule == "" {
		return nil
	}

	// If a user does not a connection to a specific auth module, create it.
	// This can happen when: using multiple auth client where the same user exists in several or
	// changing to new auth client
	if createConnection {
		return s.authInfoService.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			UserId:     userID,
			AuthModule: identity.AuthModule,
			AuthId:     identity.AuthID,
			OAuthToken: identity.OAuthToken,
		})
	}

	s.log.FromContext(ctx).Debug("Updating auth connection for user", "id", identity.ID)
	return s.authInfoService.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
		UserId:     userID,
		AuthId:     identity.AuthID,
		AuthModule: identity.AuthModule,
		OAuthToken: identity.OAuthToken,
	})
}

func (s *UserSync) updateUserAttributes(ctx context.Context, usr *user.User, id *authn.Identity, userAuth *login.UserAuth) error {
	if errProtection := s.userProtectionService.AllowUserMapping(usr, id.AuthModule); errProtection != nil {
		return errUserProtection.Errorf("user mapping not allowed: %w", errProtection)
	}
	// sync user info
	updateCmd := &user.UpdateUserCommand{
		UserID: usr.ID,
	}

	needsUpdate := false
	if id.Login != "" && id.Login != usr.Login {
		updateCmd.Login = id.Login
		usr.Login = id.Login
		needsUpdate = true
	}

	if id.Email != "" && id.Email != usr.Email {
		updateCmd.Email = id.Email
		usr.Email = id.Email
		needsUpdate = true
	}

	if id.Name != "" && id.Name != usr.Name {
		updateCmd.Name = id.Name
		usr.Name = id.Name
		needsUpdate = true
	}

	if needsUpdate {
		s.log.FromContext(ctx).Debug("Syncing user info", "id", id.ID, "update", updateCmd)
		if err := s.userService.Update(ctx, updateCmd); err != nil {
			return err
		}
	}

	// Sync isGrafanaAdmin permission
	if id.IsGrafanaAdmin != nil && *id.IsGrafanaAdmin != usr.IsAdmin {
		usr.IsAdmin = *id.IsGrafanaAdmin
		if errPerms := s.userService.UpdatePermissions(ctx, usr.ID, *id.IsGrafanaAdmin); errPerms != nil {
			return errPerms
		}
	}

	return s.upsertAuthConnection(ctx, usr.ID, id, userAuth == nil)
}

func (s *UserSync) createUser(ctx context.Context, id *authn.Identity) (*user.User, error) {
	// FIXME(jguer): this should be done in the user service
	// quota check: we can have quotas on both global and org level
	// therefore we need to query check quota for both user and org services
	for _, srv := range []string{user.QuotaTargetSrv, org.QuotaTargetSrv} {
		limitReached, errLimit := s.quotaService.CheckQuotaReached(ctx, quota.TargetSrv(srv), nil)
		if errLimit != nil {
			s.log.FromContext(ctx).Error("Failed to check quota", "error", errLimit)
			return nil, errSyncUserInternal.Errorf("%w", login.ErrGettingUserQuota)
		}
		if limitReached {
			return nil, errSyncUserForbidden.Errorf("%w", login.ErrUsersQuotaReached)
		}
	}

	isAdmin := false
	if id.IsGrafanaAdmin != nil {
		isAdmin = *id.IsGrafanaAdmin
	}

	usr, errCreateUser := s.userService.Create(ctx, &user.CreateUserCommand{
		Login:        id.Login,
		Email:        id.Email,
		Name:         id.Name,
		IsAdmin:      isAdmin,
		SkipOrgSetup: len(id.OrgRoles) > 0,
	})
	if errCreateUser != nil {
		return nil, errCreateUser
	}

	err := s.upsertAuthConnection(ctx, usr.ID, id, true)
	if err != nil {
		return nil, err
	}

	return usr, nil
}

func (s *UserSync) getUser(ctx context.Context, identity *authn.Identity) (*user.User, *login.UserAuth, error) {
	// Check auth info fist
	if identity.AuthID != "" && identity.AuthModule != "" {
		query := &login.GetAuthInfoQuery{AuthId: identity.AuthID, AuthModule: identity.AuthModule}
		authInfo, errGetAuthInfo := s.authInfoService.GetAuthInfo(ctx, query)

		if errGetAuthInfo != nil && !errors.Is(errGetAuthInfo, user.ErrUserNotFound) {
			return nil, nil, errGetAuthInfo
		}

		if !errors.Is(errGetAuthInfo, user.ErrUserNotFound) {
			usr, errGetByID := s.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: authInfo.UserId})
			if errGetByID == nil {
				return usr, authInfo, nil
			}

			if !errors.Is(errGetByID, user.ErrUserNotFound) {
				return nil, nil, errGetByID
			}

			// if the user connected to user auth does not exist try to clean it up
			if errors.Is(errGetByID, user.ErrUserNotFound) {
				if err := s.authInfoService.DeleteUserAuthInfo(ctx, authInfo.UserId); err != nil {
					s.log.FromContext(ctx).Error("Failed to clean up user auth", "error", err, "auth_module", identity.AuthModule, "auth_id", identity.AuthID)
				}
			}
		}
	}

	// Check user table to grab existing user
	usr, err := s.lookupByOneOf(ctx, identity.ClientParams.LookUpParams)
	if err != nil {
		return nil, nil, err
	}

	var userAuth *login.UserAuth
	// Special case for generic oauth: generic oauth does not store authID,
	// so we need to find the user first then check for the userAuth connection by module and userID
	if identity.AuthModule == login.GenericOAuthModule {
		query := &login.GetAuthInfoQuery{AuthModule: identity.AuthModule, UserId: usr.ID}
		userAuth, err = s.authInfoService.GetAuthInfo(ctx, query)
		if err != nil && !errors.Is(err, user.ErrUserNotFound) {
			return nil, nil, err
		}
	}

	return usr, userAuth, nil
}

func (s *UserSync) lookupByOneOf(ctx context.Context, params login.UserLookupParams) (*user.User, error) {
	var usr *user.User
	var err error

	// If not found, try to find the user by id
	if params.UserID != nil && *params.UserID != 0 {
		usr, err = s.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: *params.UserID})
		if err != nil && !errors.Is(err, user.ErrUserNotFound) {
			return nil, err
		}
	}

	// If not found, try to find the user by email address
	if usr == nil && params.Email != nil && *params.Email != "" {
		usr, err = s.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: *params.Email})
		if err != nil && !errors.Is(err, user.ErrUserNotFound) {
			return nil, err
		}
	}

	// If not found, try to find the user by login
	if usr == nil && params.Login != nil && *params.Login != "" {
		usr, err = s.userService.GetByLogin(ctx, &user.GetUserByLoginQuery{LoginOrEmail: *params.Login})
		if err != nil && !errors.Is(err, user.ErrUserNotFound) {
			return nil, err
		}
	}

	if usr == nil || usr.ID == 0 { // id check as safeguard against returning empty user
		return nil, user.ErrUserNotFound
	}

	return usr, nil
}

// syncUserToIdentity syncs a user to an identity.
// This is used to update the identity with the latest user information.
func syncUserToIdentity(usr *user.User, id *authn.Identity) {
	id.ID = authn.NamespacedID(authn.NamespaceUser, usr.ID)
	id.Login = usr.Login
	id.Email = usr.Email
	id.Name = usr.Name
	id.IsGrafanaAdmin = &usr.IsAdmin
}

// syncSignedInUserToIdentity syncs a user to an identity.
func syncSignedInUserToIdentity(usr *user.SignedInUser, identity *authn.Identity) {
	identity.Name = usr.Name
	identity.Login = usr.Login
	identity.Email = usr.Email
	identity.OrgID = usr.OrgID
	identity.OrgName = usr.OrgName
	identity.OrgCount = usr.OrgCount
	identity.OrgRoles = map[int64]org.RoleType{identity.OrgID: usr.OrgRole}
	identity.HelpFlags1 = usr.HelpFlags1
	identity.Teams = usr.Teams
	identity.LastSeenAt = usr.LastSeenAt
	identity.IsDisabled = usr.IsDisabled
	identity.IsGrafanaAdmin = &usr.IsGrafanaAdmin
}

func shouldUpdateLastSeen(t time.Time) bool {
	return time.Since(t) > time.Minute*5
}
