package sync

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errSyncUserForbidden = errutil.NewBase(errutil.StatusForbidden,
		"user.sync.forbidden", errutil.WithPublicMessage("User sync forbidden"))
	errSyncUserInternal = errutil.NewBase(errutil.StatusInternal,
		"user.sync.forbidden", errutil.WithPublicMessage("User sync failed"))
	errUserProtection = errutil.NewBase(errutil.StatusForbidden,
		"user.sync.protectedrole", errutil.WithPublicMessage("Unable to sync due to protected role"))
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

// SyncUser syncs a user with the database
func (s *UserSync) SyncUser(ctx context.Context, id *authn.Identity, _ *authn.Request) error {
	if !id.ClientParams.SyncUser {
		return nil
	}

	// Does user exist in the database?
	usr, errUserInDB := s.UserInDB(ctx, &id.AuthModule, &id.AuthID, id.ClientParams.LookUpParams)
	if errUserInDB != nil && !errors.Is(errUserInDB, user.ErrUserNotFound) {
		s.log.Error("error retrieving user", "error", errUserInDB,
			"auth_module", id.AuthModule, "auth_id", id.AuthID,
			"lookup_params", id.ClientParams.LookUpParams,
		)
		return errSyncUserInternal.Errorf("unable to retrieve user")
	}

	if errors.Is(errUserInDB, user.ErrUserNotFound) {
		if !id.ClientParams.AllowSignUp {
			s.log.Warn("not allowing login, user not found in internal user database and allow signup = false",
				"auth_module", id.AuthModule)
			return errSyncUserForbidden.Errorf("%w", login.ErrSignupNotAllowed)
		}

		// quota check (FIXME: (jguer) this should be done in the user service)
		// we may insert in both user and org_user tables
		// therefore we need to query check quota for both user and org services
		for _, srv := range []string{user.QuotaTargetSrv, org.QuotaTargetSrv} {
			limitReached, errLimit := s.quotaService.CheckQuotaReached(ctx, quota.TargetSrv(srv), nil)
			if errLimit != nil {
				s.log.Error("error getting user quota", "error", errLimit)
				return errSyncUserInternal.Errorf("%w", login.ErrGettingUserQuota)
			}
			if limitReached {
				return errSyncUserForbidden.Errorf("%w", login.ErrUsersQuotaReached)
			}
		}

		// create user
		var errCreate error
		usr, errCreate = s.createUser(ctx, id)
		if errCreate != nil {
			s.log.Error("error creating user", "error", errCreate,
				"auth_module", id.AuthModule, "auth_id", id.AuthID,
				"id_login", id.Login, "id_email", id.Email,
			)
			return errSyncUserInternal.Errorf("unable to create user")
		}
	}

	if errProtection := s.userProtectionService.AllowUserMapping(usr, id.AuthModule); errProtection != nil {
		return errUserProtection.Errorf("user mapping not allowed: %w", errProtection)
	}

	// update user
	if errUpdate := s.updateUserAttributes(ctx, usr, id); errUpdate != nil {
		s.log.Error("error creating user", "error", errUpdate,
			"auth_module", id.AuthModule, "auth_id", id.AuthID,
			"login", usr.Login, "email", usr.Email,
			"id_login", id.Login, "id_email", id.Email,
		)
		return errSyncUserInternal.Errorf("unable to update user")
	}

	syncUserToIdentity(usr, id)

	// persist latest auth info token
	if errAuthInfo := s.updateAuthInfo(ctx, id); errAuthInfo != nil {
		s.log.Error("error creating user", "error", errAuthInfo,
			"auth_module", id.AuthModule, "auth_id", id.AuthID,
		)
		return errSyncUserInternal.Errorf("unable to update auth info")
	}

	return nil
}

// syncUserToIdentity syncs a user to an identity.
// This is used to update the identity with the latest user information.
func syncUserToIdentity(usr *user.User, id *authn.Identity) {
	id.ID = fmt.Sprintf("user:%d", usr.ID)
	id.Login = usr.Login
	id.Email = usr.Email
	id.Name = usr.Name
	id.IsGrafanaAdmin = &usr.IsAdmin
}

func (s *UserSync) updateAuthInfo(ctx context.Context, id *authn.Identity) error {
	if id.AuthModule != "" && id.OAuthToken != nil && id.AuthID != "" {
		return nil
	}

	namespace, userID := id.NamespacedID()
	if namespace != "user" && userID <= 0 { // FIXME: constant namespace
		return fmt.Errorf("invalid namespace %q for user ID %q", namespace, userID)
	}

	updateCmd := &models.UpdateAuthInfoCommand{
		AuthModule: id.AuthModule,
		AuthId:     id.AuthID,
		UserId:     userID,
		OAuthToken: id.OAuthToken,
	}

	s.log.Debug("Updating user_auth info", "user_id", userID)
	return s.authInfoService.UpdateAuthInfo(ctx, updateCmd)
}

func (s *UserSync) updateUserAttributes(ctx context.Context, usr *user.User, id *authn.Identity) error {
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
		s.log.Debug("Syncing user info", "id", usr.ID, "update", updateCmd)
		if err := s.userService.Update(ctx, updateCmd); err != nil {
			return err
		}
	}

	if usr.IsDisabled && id.ClientParams.EnableDisabledUsers {
		usr.IsDisabled = false
		if errDisableUser := s.userService.Disable(ctx,
			&user.DisableUserCommand{
				UserID: usr.ID, IsDisabled: false}); errDisableUser != nil {
			return errDisableUser
		}
	}

	// Sync isGrafanaAdmin permission
	if id.IsGrafanaAdmin != nil && *id.IsGrafanaAdmin != usr.IsAdmin {
		usr.IsAdmin = *id.IsGrafanaAdmin
		if errPerms := s.userService.UpdatePermissions(ctx, usr.ID, *id.IsGrafanaAdmin); errPerms != nil {
			return errPerms
		}
	}

	return nil
}

func (s *UserSync) createUser(ctx context.Context, id *authn.Identity) (*user.User, error) {
	isAdmin := false
	if id.IsGrafanaAdmin != nil {
		isAdmin = *id.IsGrafanaAdmin
	}

	// TODO: add quota check
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

	if id.AuthModule != "" && id.AuthID != "" {
		if errSetAuth := s.authInfoService.SetAuthInfo(ctx, &models.SetAuthInfoCommand{
			UserId:     usr.ID,
			AuthModule: id.AuthModule,
			AuthId:     id.AuthID,
			OAuthToken: id.OAuthToken,
		}); errSetAuth != nil {
			return nil, errSetAuth
		}
	}

	return usr, nil
}

// Does user exist in the database?
// Check first authinfo table, then user table
// return user id if found, 0 if not found
func (s *UserSync) UserInDB(ctx context.Context,
	authID *string,
	authModule *string,
	params models.UserLookupParams) (*user.User, error) {
	// Check authinfo table
	if authID != nil && authModule != nil {
		query := &models.GetAuthInfoQuery{
			AuthModule: *authModule,
			AuthId:     *authID,
		}
		errGetAuthInfo := s.authInfoService.GetAuthInfo(ctx, query)
		if errGetAuthInfo == nil {
			usr, errGetByID := s.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: query.Result.UserId})
			if errGetByID == nil {
				return usr, nil
			}

			if !errors.Is(errGetByID, user.ErrUserNotFound) {
				return nil, errGetByID
			}
		}

		if !errors.Is(errGetAuthInfo, user.ErrUserNotFound) {
			return nil, errGetAuthInfo
		}
	}

	// Check user table to grab existing user
	return s.LookupByOneOf(ctx, &params)
}

func (s *UserSync) LookupByOneOf(ctx context.Context, params *models.UserLookupParams) (*user.User, error) {
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
