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
func (ls *Implementation) UpsertUser(ctx context.Context, cmd *login.UpsertUserCommand) (result *user.User, err error) {
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
			return nil, errAuthLookup
		}

		if !cmd.SignupAllowed {
			logger.Warn("Not allowing login, user not found in internal user database and allow signup = false", "authmode", extUser.AuthModule)
			return nil, login.ErrSignupNotAllowed
		}

		// quota check (FIXME: (jguer) this should be done in the user service)
		// we may insert in both user and org_user tables
		// therefore we need to query check quota for both user and org services
		for _, srv := range []string{user.QuotaTargetSrv, org.QuotaTargetSrv} {
			limitReached, errLimit := ls.QuotaService.CheckQuotaReached(ctx, quota.TargetSrv(srv), nil)
			if errLimit != nil {
				logger.Warn("Error getting user quota.", "error", errLimit)
				return nil, login.ErrGettingUserQuota
			}
			if limitReached {
				return nil, login.ErrUsersQuotaReached
			}
		}

		createdUser, errCreateUser := ls.userService.Create(ctx, &user.CreateUserCommand{
			Login:        extUser.Login,
			Email:        extUser.Email,
			Name:         extUser.Name,
			SkipOrgSetup: len(extUser.OrgRoles) > 0,
		})
		if errCreateUser != nil {
			return nil, errCreateUser
		}

		result = &user.User{
			ID:               createdUser.ID,
			Version:          createdUser.Version,
			Email:            createdUser.Email,
			Name:             createdUser.Name,
			Login:            createdUser.Login,
			Password:         createdUser.Password,
			Salt:             createdUser.Salt,
			Rands:            createdUser.Rands,
			Company:          createdUser.Company,
			EmailVerified:    createdUser.EmailVerified,
			Theme:            createdUser.Theme,
			HelpFlags1:       createdUser.HelpFlags1,
			IsDisabled:       createdUser.IsDisabled,
			IsAdmin:          createdUser.IsAdmin,
			IsServiceAccount: createdUser.IsServiceAccount,
			OrgID:            createdUser.OrgID,
			Created:          createdUser.Created,
			Updated:          createdUser.Updated,
			LastSeenAt:       createdUser.LastSeenAt,
		}

		if extUser.AuthModule != "" {
			cmd2 := &login.SetAuthInfoCommand{
				UserId:     result.ID,
				AuthModule: extUser.AuthModule,
				AuthId:     extUser.AuthId,
				OAuthToken: extUser.OAuthToken,
			}
			if errSetAuth := ls.AuthInfoService.SetAuthInfo(ctx, cmd2); errSetAuth != nil {
				return nil, errSetAuth
			}
		}
	} else {
		result = usr

		if errUserMod := ls.updateUser(ctx, result, extUser); errUserMod != nil {
			return nil, errUserMod
		}

		// Always persist the latest token at log-in
		if extUser.AuthModule != "" && extUser.OAuthToken != nil {
			if errAuthMod := ls.updateUserAuth(ctx, result, extUser); errAuthMod != nil {
				return nil, errAuthMod
			}
		}

		if extUser.AuthModule == login.LDAPAuthModule && usr.IsDisabled {
			// Re-enable user when it found in LDAP
			if errDisableUser := ls.userService.Disable(ctx,
				&user.DisableUserCommand{
					UserID: result.ID, IsDisabled: false}); errDisableUser != nil {
				return nil, errDisableUser
			}
		}
	}

	if errSyncRole := ls.syncOrgRoles(ctx, result, extUser); errSyncRole != nil {
		return nil, errSyncRole
	}

	// Sync isGrafanaAdmin permission
	if extUser.IsGrafanaAdmin != nil && *extUser.IsGrafanaAdmin != result.IsAdmin {
		if errPerms := ls.userService.UpdatePermissions(ctx, result.ID, *extUser.IsGrafanaAdmin); errPerms != nil {
			return nil, errPerms
		}
	}

	// There are external providers where we want to completely skip team synchronization see - https://github.com/grafana/grafana/issues/62175
	if ls.TeamSync != nil && !extUser.SkipTeamSync {
		if errTeamSync := ls.TeamSync(result, extUser); errTeamSync != nil {
			return nil, errTeamSync
		}
	}

	return result, nil
}

func (ls *Implementation) DisableExternalUser(ctx context.Context, username string) error {
	// Check if external user exist in Grafana
	userQuery := &login.GetExternalUserInfoByLoginQuery{
		LoginOrEmail: username,
	}

	userInfo, err := ls.AuthInfoService.GetExternalUserInfoByLogin(ctx, userQuery)
	if err != nil {
		return err
	}

	if userInfo.IsDisabled {
		return nil
	}

	logger.Debug(
		"Disabling external user",
		"user",
		userInfo.Login,
	)

	// Mark user as disabled in grafana db
	disableUserCmd := &user.DisableUserCommand{
		UserID:     userInfo.UserId,
		IsDisabled: true,
	}

	if err := ls.userService.Disable(ctx, disableUserCmd); err != nil {
		logger.Debug(
			"Error disabling external user",
			"user",
			userInfo.Login,
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
