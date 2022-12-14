package usersync

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
)

type postSyncHookFn func(ctx context.Context, identity *authn.Identity) error

type Service struct {
	postSyncHooks   []postSyncHookFn
	userService     user.Service
	authInfoService login.AuthInfoService
	quotaService    quota.Service
	accessControl   accesscontrol.Service
	orgService      org.Service
	log             log.Logger
}

// RegisterPostSyncHook registers a hook that is called after a successful user sync.
func (s *Service) RegisterPostSyncHook(ctx context.Context, fn postSyncHookFn) error {
	s.postSyncHooks = append(s.postSyncHooks, fn)
	return nil
}

// SyncUser syncs a user with the database
func (s *Service) SyncUser(ctx context.Context, clientParams *authn.ClientParams, id *authn.Identity) error {
	if !clientParams.SyncUser {
		return nil
	}

	// Does user exist in the database?
	usr, errUserInDB := s.UserInDB(ctx, &id.AuthModule, &id.AuthID, id.LookUpParams)
	if errUserInDB != nil && errors.Is(errUserInDB, user.ErrUserNotFound) {
		if !clientParams.AllowSignUp {
			s.log.Warn("Not allowing login, user not found in internal user database and allow signup = false",
				"auth_module", id.AuthModule)
			return login.ErrSignupNotAllowed
		}

		// create user
		var errCreate error
		usr, errCreate = s.createUser(ctx, id)
		if errCreate != nil {
			return errCreate
		}
	}

	if errUserInDB != nil {
		return errUserInDB
	}

	// update user
	if errUpdate := s.updateUserAttributes(ctx, usr, id); errUpdate != nil {
		return errUpdate
	}

	// persist latest auth info token
	if errAuthInfo := s.updateAuthInfo(ctx, id); errAuthInfo != nil {
		return errAuthInfo
	}

	syncUserToIdentity(usr, id)

	return nil
}

func syncUserToIdentity(usr *user.User, id *authn.Identity) {
	id.Login = usr.Login
	id.Email = usr.Email
	id.Name = usr.Name
}

// FIXME: UserID should come from the identity namespaced ID
func (s *Service) updateAuthInfo(ctx context.Context, id *authn.Identity) error {
	if id.AuthModule != "" && id.OAuthToken != nil && id.AuthID != "" {
		return nil
	}

	updateCmd := &models.UpdateAuthInfoCommand{
		AuthModule: id.AuthModule,
		AuthId:     id.AuthID,
		UserId:     *id.LookUpParams.UserID,
		OAuthToken: id.OAuthToken,
	}

	s.log.Debug("Updating user_auth info", "user_id", id.LookUpParams.UserID)
	return s.authInfoService.UpdateAuthInfo(ctx, updateCmd)
}

func (s *Service) updateUserAttributes(ctx context.Context, usr *user.User, id *authn.Identity) error {
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

	if usr.IsDisabled {
		if errDisableUser := s.userService.Disable(ctx,
			&user.DisableUserCommand{
				UserID: usr.ID, IsDisabled: false}); errDisableUser != nil {
			return errDisableUser
		}
	}

	if !needsUpdate {
		return nil
	}

	s.log.Debug("Syncing user info", "id", usr.ID, "update", updateCmd)
	return s.userService.Update(ctx, updateCmd)
}

func (s *Service) createUser(ctx context.Context, id *authn.Identity) (*user.User, error) {
	// TODO: add quota check
	usr, errCreateUser := s.userService.Create(ctx, &user.CreateUserCommand{
		Login:        id.Login,
		Email:        id.Email,
		Name:         id.Name,
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
func (s *Service) UserInDB(ctx context.Context,
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
			usr, errGetByID := s.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: *params.UserID})
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

	// Check user table to grab exising user
	return s.LookupByOneOf(ctx, &params)
}

func (s *Service) LookupByOneOf(ctx context.Context, params *models.UserLookupParams) (*user.User, error) {
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

	if usr == nil {
		return nil, user.ErrUserNotFound
	}

	return usr, nil
}
