package loginservice

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	logger = log.New("login.ext_user")
)

func ProvideService(
	userService user.Service,
	quotaService quota.Service,
	authInfoService login.AuthInfoService,
	accessControl accesscontrol.Service,
	orgService org.Service,
) *Implementation {
	s := &Implementation{
		userService:     userService,
		QuotaService:    quotaService,
		AuthInfoService: authInfoService,
		accessControl:   accessControl,
		orgService:      orgService,
	}
	return s
}

type Implementation struct {
	userService     user.Service
	AuthInfoService login.AuthInfoService
	QuotaService    quota.Service
	TeamSync        login.TeamSyncFunc
	accessControl   accesscontrol.Service
	orgService      org.Service
}

// UpsertUser updates an existing user, or if it doesn't exist, inserts a new one.
func (ls *Implementation) UpsertUser(ctx context.Context, cmd *login.UpsertUserCommand) error {
	var logger log.Logger = logger
	if cmd.ReqContext != nil && cmd.ReqContext.Logger != nil {
		logger = cmd.ReqContext.Logger
	}

	extUser := cmd.ExternalUser

	usr, errAuthLookup := ls.AuthInfoService.LookupAndUpdate(ctx, &login.GetUserByAuthInfoQuery{
		AuthModule:       extUser.AuthModule,
		AuthId:           extUser.AuthId,
		UserLookupParams: cmd.UserLookupParams,
	})
	if errAuthLookup != nil {
		if !errors.Is(errAuthLookup, user.ErrUserNotFound) {
			return errAuthLookup
		}

		if !cmd.SignupAllowed {
			logger.Warn("Not allowing login, user not found in internal user database and allow signup = false", "authmode", extUser.AuthModule)
			return login.ErrSignupNotAllowed
		}

		// quota check (FIXME: (jguer) this should be done in the user service)
		// we may insert in both user and org_user tables
		// therefore we need to query check quota for both user and org services
		for _, srv := range []string{user.QuotaTargetSrv, org.QuotaTargetSrv} {
			limitReached, errLimit := ls.QuotaService.CheckQuotaReached(ctx, quota.TargetSrv(srv), nil)
			if errLimit != nil {
				logger.Warn("Error getting user quota.", "error", errLimit)
				return login.ErrGettingUserQuota
			}
			if limitReached {
				return login.ErrUsersQuotaReached
			}
		}

		result, errCreateUser := ls.userService.Create(ctx, &user.CreateUserCommand{
			Login:        extUser.Login,
			Email:        extUser.Email,
			Name:         extUser.Name,
			SkipOrgSetup: len(extUser.OrgRoles) > 0,
		})
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
			cmd2 := &login.SetAuthInfoCommand{
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
		if errPerms := ls.userService.UpdatePermissions(ctx, cmd.Result.ID, *extUser.IsGrafanaAdmin); errPerms != nil {
			return errPerms
		}
	}

	// There are external providers where we want to completely skip team synchronization see - https://github.com/grafana/grafana/issues/62175
	if ls.TeamSync != nil && !extUser.SkipTeamSync {
		if errTeamSync := ls.TeamSync(cmd.Result, extUser); errTeamSync != nil {
			return errTeamSync
		}
	}

	return nil
}

func (ls *Implementation) DisableExternalUser(ctx context.Context, username string) error {
	// Check if external user exist in Grafana
	userQuery := &login.GetExternalUserInfoByLoginQuery{
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

func (ls *Implementation) updateUser(ctx context.Context, usr *user.User, extUser *login.ExternalUserInfo) error {
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

func (ls *Implementation) updateUserAuth(ctx context.Context, user *user.User, extUser *login.ExternalUserInfo) error {
	updateCmd := &login.UpdateAuthInfoCommand{
		AuthModule: extUser.AuthModule,
		AuthId:     extUser.AuthId,
		UserId:     user.ID,
		OAuthToken: extUser.OAuthToken,
	}

	logger.Debug("Updating user_auth info", "user_id", user.ID)
	return ls.AuthInfoService.UpdateAuthInfo(ctx, updateCmd)
}

func (ls *Implementation) syncOrgRoles(ctx context.Context, usr *user.User, extUser *login.ExternalUserInfo) error {
	logger.Debug("Syncing organization roles", "id", usr.ID, "extOrgRoles", extUser.OrgRoles)

	// don't sync org roles if none is specified
	if len(extUser.OrgRoles) == 0 {
		logger.Debug("Not syncing organization roles since external user doesn't have any")
		return nil
	}

	orgsQuery := &org.GetUserOrgListQuery{UserID: usr.ID}
	result, err := ls.orgService.GetUserOrgList(ctx, orgsQuery)
	if err != nil {
		return err
	}

	handledOrgIds := map[int64]bool{}
	deleteOrgIds := []int64{}

	// update existing org roles
	for _, orga := range result {
		handledOrgIds[orga.OrgID] = true

		extRole := extUser.OrgRoles[orga.OrgID]
		if extRole == "" {
			deleteOrgIds = append(deleteOrgIds, orga.OrgID)
		} else if extRole != orga.Role {
			// update role
			cmd := &org.UpdateOrgUserCommand{OrgID: orga.OrgID, UserID: usr.ID, Role: extRole}
			if err := ls.orgService.UpdateOrgUser(ctx, cmd); err != nil {
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
		cmd := &org.AddOrgUserCommand{UserID: usr.ID, Role: orgRole, OrgID: orgId}
		err := ls.orgService.AddOrgUser(ctx, cmd)
		if err != nil && !errors.Is(err, org.ErrOrgNotFound) {
			return err
		}
	}

	// delete any removed org roles
	for _, orgId := range deleteOrgIds {
		logger.Debug("Removing user's organization membership as part of syncing with OAuth login",
			"userId", usr.ID, "orgId", orgId)
		cmd := &org.RemoveOrgUserCommand{OrgID: orgId, UserID: usr.ID}
		if err := ls.orgService.RemoveOrgUser(ctx, cmd); err != nil {
			if errors.Is(err, org.ErrLastOrgAdmin) {
				logger.Error(err.Error(), "userId", cmd.UserID, "orgId", cmd.OrgID)
				continue
			}

			return err
		}

		if err := ls.accessControl.DeleteUserPermissions(ctx, orgId, cmd.UserID); err != nil {
			logger.Warn("failed to delete permissions for user", "error", err, "userID", cmd.UserID, "orgID", orgId)
		}
	}

	// update user's default org if needed
	if _, ok := extUser.OrgRoles[usr.OrgID]; !ok {
		for orgId := range extUser.OrgRoles {
			usr.OrgID = orgId
			break
		}

		return ls.userService.SetUsingOrg(ctx, &user.SetUsingOrgCommand{
			UserID: usr.ID,
			OrgID:  usr.OrgID,
		})
	}

	return nil
}
