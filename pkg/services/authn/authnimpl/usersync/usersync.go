package usersync

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
)

type UserSync struct {
	userService     user.Service
	authInfoService login.AuthInfoService
	quotaService    quota.Service
	log             log.Logger
}

// SyncUser syncs a user with the database
func (s *UserSync) SyncUser(ctx context.Context, clientParams *authn.ClientParams, id *authn.Identity) error {
	if !clientParams.SyncUser {
		s.log.Debug("Not syncing user", "auth_module", id.AuthModule, "auth_id", id.AuthID)
		return nil
	}

	// Does user exist in the database?
	usr, errUserInDB := s.UserInDB(ctx, &id.AuthModule, &id.AuthID, id.LookUpParams)
	if errUserInDB != nil && !errors.Is(errUserInDB, user.ErrUserNotFound) {
		return errUserInDB
	}

	if errors.Is(errUserInDB, user.ErrUserNotFound) {
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

	// update user
	if errUpdate := s.updateUserAttributes(ctx, clientParams, usr, id); errUpdate != nil {
		return errUpdate
	}

	syncUserToIdentity(usr, id)

	// persist latest auth info token
	if errAuthInfo := s.updateAuthInfo(ctx, id); errAuthInfo != nil {
		return errAuthInfo
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
	if namespace != "user" { // FIXME: constant namespace
		return nil // FIXME: we should return an error here
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

func (s *UserSync) updateUserAttributes(ctx context.Context, clientParams *authn.ClientParams, usr *user.User, id *authn.Identity) error {
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

	if usr.IsDisabled && clientParams.EnableDisabledUsers {
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

	if usr == nil {
		return nil, user.ErrUserNotFound
	}

	return usr, nil
}
