package loginservice

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	logger = log.New("login.ext_user")
)

func ProvideService(
	sqlStore sqlstore.Store,
	userService user.Service,
	quotaService quota.Service,
	authInfoService login.AuthInfoService,
	accessControl accesscontrol.Service,
) *Implementation {
	s := &Implementation{
		SQLStore:        sqlStore,
		userService:     userService,
		QuotaService:    quotaService,
		AuthInfoService: authInfoService,
		accessControl:   accessControl,
	}
	return s
}

type Implementation struct {
	SQLStore        sqlstore.Store
	userService     user.Service
	AuthInfoService login.AuthInfoService
	QuotaService    quota.Service
	TeamSync        login.TeamSyncFunc
	accessControl   accesscontrol.Service
}

// CreateUser creates inserts a new one.
func (ls *Implementation) CreateUser(cmd user.CreateUserCommand) (*user.User, error) {
	return ls.SQLStore.CreateUser(context.Background(), cmd)
}

// UpsertUser updates an existing user, or if it doesn't exist, inserts a new one.
func (ls *Implementation) UpsertUser(ctx context.Context, cmd *models.UpsertUserCommand) error {
	extUser := cmd.ExternalUser

	usr, errAuthLookup := ls.AuthInfoService.LookupAndUpdate(ctx, &models.GetUserByAuthInfoQuery{
		AuthModule:       extUser.AuthModule,
		AuthId:           extUser.AuthId,
		UserLookupParams: cmd.UserLookupParams,
	})
	if errAuthLookup != nil {
		if !errors.Is(errAuthLookup, user.ErrUserNotFound) {
			return errAuthLookup
		}

		if !cmd.SignupAllowed {
			cmd.ReqContext.Logger.Warn("Not allowing login, user not found in internal user database and allow signup = false", "authmode", extUser.AuthModule)
			return login.ErrSignupNotAllowed
		}

		limitReached, errLimit := ls.QuotaService.QuotaReached(cmd.ReqContext, "user")
		if errLimit != nil {
			cmd.ReqContext.Logger.Warn("Error getting user quota.", "error", errLimit)
			return login.ErrGettingUserQuota
		}
		if limitReached {
			return login.ErrUsersQuotaReached
		}

		result, errCreateUser := ls.createUser(extUser)
		if errCreateUser != nil {
			return errCreateUser
		}

		cmd.Result = &user.User{
			ID:               result.ID,
			Version:          result.Version,
			Email:            result.Email,
			Name:             result.Name,
			Login:            result.Login,
			Password:         result.Password,
			Salt:             result.Salt,
			Rands:            result.Rands,
			Company:          result.Company,
			EmailVerified:    result.EmailVerified,
			Theme:            result.Theme,
			HelpFlags1:       result.HelpFlags1,
			IsDisabled:       result.IsDisabled,
			IsAdmin:          result.IsAdmin,
			IsServiceAccount: result.IsServiceAccount,
			OrgID:            result.OrgID,
			Created:          result.Created,
			Updated:          result.Updated,
			LastSeenAt:       result.LastSeenAt,
		}

		if extUser.AuthModule != "" {
			cmd2 := &models.SetAuthInfoCommand{
				UserId:     cmd.Result.ID,
				AuthModule: extUser.AuthModule,
				AuthId:     extUser.AuthId,
				OAuthToken: extUser.OAuthToken,
			}
			if errSetAuth := ls.AuthInfoService.SetAuthInfo(ctx, cmd2); errSetAuth != nil {
				return errSetAuth
			}
		}
	} else {
		cmd.Result = usr

		if errUserMod := ls.updateUser(ctx, cmd.Result, extUser); errUserMod != nil {
			return errUserMod
		}

		// Always persist the latest token at log-in
		if extUser.AuthModule != "" && extUser.OAuthToken != nil {
			if errAuthMod := ls.updateUserAuth(ctx, cmd.Result, extUser); errAuthMod != nil {
				return errAuthMod
			}
		}

		if extUser.AuthModule == login.LDAPAuthModule && usr.IsDisabled {
			// Re-enable user when it found in LDAP
			if errDisableUser := ls.userService.Disable(ctx,
				&user.DisableUserCommand{
					UserID: cmd.Result.ID, IsDisabled: false}); errDisableUser != nil {
				return errDisableUser
			}
		}
	}

	if errSyncRole := ls.syncOrgRoles(ctx, cmd.Result, extUser); errSyncRole != nil {
		return errSyncRole
	}

	// Sync isGrafanaAdmin permission
	if extUser.IsGrafanaAdmin != nil && *extUser.IsGrafanaAdmin != cmd.Result.IsAdmin {
		if errPerms := ls.SQLStore.UpdateUserPermissions(cmd.Result.ID, *extUser.IsGrafanaAdmin); errPerms != nil {
			return errPerms
		}
	}

	if ls.TeamSync != nil {
		if errTeamSync := ls.TeamSync(cmd.Result, extUser); errTeamSync != nil {
			return errTeamSync
		}
	}

	return nil
}

func (ls *Implementation) DisableExternalUser(ctx context.Context, username string) error {
	// Check if external user exist in Grafana
	userQuery := &models.GetExternalUserInfoByLoginQuery{
		LoginOrEmail: username,
	}

	if err := ls.AuthInfoService.GetExternalUserInfoByLogin(ctx, userQuery); err != nil {
		return err
	}

	userInfo := userQuery.Result
	if userInfo.IsDisabled {
		return nil
	}

	logger.Debug(
		"Disabling external user",
		"user",
		userQuery.Result.Login,
	)

	// Mark user as disabled in grafana db
	disableUserCmd := &user.DisableUserCommand{
		UserID:     userQuery.Result.UserId,
		IsDisabled: true,
	}

	if err := ls.userService.Disable(ctx, disableUserCmd); err != nil {
		logger.Debug(
			"Error disabling external user",
			"user",
			userQuery.Result.Login,
			"message",
			err.Error(),
		)
		return err
	}
	return nil
}

// SetTeamSyncFunc sets the function received through args as the team sync function.
func (ls *Implementation) SetTeamSyncFunc(teamSyncFunc login.TeamSyncFunc) {
	ls.TeamSync = teamSyncFunc
}

func (ls *Implementation) createUser(extUser *models.ExternalUserInfo) (*user.User, error) {
	cmd := user.CreateUserCommand{
		Login:        extUser.Login,
		Email:        extUser.Email,
		Name:         extUser.Name,
		SkipOrgSetup: len(extUser.OrgRoles) > 0,
	}
	return ls.CreateUser(cmd)
}

func (ls *Implementation) updateUser(ctx context.Context, usr *user.User, extUser *models.ExternalUserInfo) error {
	// sync user info
	updateCmd := &user.UpdateUserCommand{
		UserID: usr.ID,
	}

	needsUpdate := false
	if extUser.Login != "" && extUser.Login != usr.Login {
		updateCmd.Login = extUser.Login
		usr.Login = extUser.Login
		needsUpdate = true
	}

	if extUser.Email != "" && extUser.Email != usr.Email {
		updateCmd.Email = extUser.Email
		usr.Email = extUser.Email
		needsUpdate = true
	}

	if extUser.Name != "" && extUser.Name != usr.Name {
		updateCmd.Name = extUser.Name
		usr.Name = extUser.Name
		needsUpdate = true
	}

	if !needsUpdate {
		return nil
	}

	logger.Debug("Syncing user info", "id", usr.ID, "update", updateCmd)
	return ls.userService.Update(ctx, updateCmd)
}

func (ls *Implementation) updateUserAuth(ctx context.Context, user *user.User, extUser *models.ExternalUserInfo) error {
	updateCmd := &models.UpdateAuthInfoCommand{
		AuthModule: extUser.AuthModule,
		AuthId:     extUser.AuthId,
		UserId:     user.ID,
		OAuthToken: extUser.OAuthToken,
	}

	logger.Debug("Updating user_auth info", "user_id", user.ID)
	return ls.AuthInfoService.UpdateAuthInfo(ctx, updateCmd)
}

func (ls *Implementation) syncOrgRoles(ctx context.Context, usr *user.User, extUser *models.ExternalUserInfo) error {
	logger.Debug("Syncing organization roles", "id", usr.ID, "extOrgRoles", extUser.OrgRoles)

	// don't sync org roles if none is specified
	if len(extUser.OrgRoles) == 0 {
		logger.Debug("Not syncing organization roles since external user doesn't have any")
		return nil
	}

	orgsQuery := &models.GetUserOrgListQuery{UserId: usr.ID}
	if err := ls.SQLStore.GetUserOrgList(ctx, orgsQuery); err != nil {
		return err
	}

	handledOrgIds := map[int64]bool{}
	deleteOrgIds := []int64{}

	// update existing org roles
	for _, org := range orgsQuery.Result {
		handledOrgIds[org.OrgId] = true

		extRole := extUser.OrgRoles[org.OrgId]
		if extRole == "" {
			deleteOrgIds = append(deleteOrgIds, org.OrgId)
		} else if extRole != org.Role {
			// update role
			cmd := &models.UpdateOrgUserCommand{OrgId: org.OrgId, UserId: usr.ID, Role: extRole}
			if err := ls.SQLStore.UpdateOrgUser(ctx, cmd); err != nil {
				return err
			}
		}
	}

	// add any new org roles
	for orgId, orgRole := range extUser.OrgRoles {
		if _, exists := handledOrgIds[orgId]; exists {
			continue
		}

		// add role
		cmd := &models.AddOrgUserCommand{UserId: usr.ID, Role: orgRole, OrgId: orgId}
		err := ls.SQLStore.AddOrgUser(ctx, cmd)
		if err != nil && !errors.Is(err, models.ErrOrgNotFound) {
			return err
		}
	}

	// delete any removed org roles
	for _, orgId := range deleteOrgIds {
		logger.Debug("Removing user's organization membership as part of syncing with OAuth login",
			"userId", usr.ID, "orgId", orgId)
		cmd := &models.RemoveOrgUserCommand{OrgId: orgId, UserId: usr.ID}
		if err := ls.SQLStore.RemoveOrgUser(ctx, cmd); err != nil {
			if errors.Is(err, models.ErrLastOrgAdmin) {
				logger.Error(err.Error(), "userId", cmd.UserId, "orgId", cmd.OrgId)
				continue
			}
			if err := ls.accessControl.DeleteUserPermissions(ctx, orgId, cmd.UserId); err != nil {
				logger.Warn("failed to delete permissions for user", "userID", cmd.UserId, "orgID", orgId)
			}

			return err
		}
	}

	// update user's default org if needed
	if _, ok := extUser.OrgRoles[usr.OrgID]; !ok {
		for orgId := range extUser.OrgRoles {
			usr.OrgID = orgId
			break
		}

		return ls.SQLStore.SetUsingOrg(ctx, &models.SetUsingOrgCommand{
			UserId: usr.ID,
			OrgId:  usr.OrgID,
		})
	}

	return nil
}
