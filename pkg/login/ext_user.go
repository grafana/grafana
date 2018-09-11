package login

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/quota"
)

func init() {
	bus.AddHandler("auth", UpsertUser)
}

func UpsertUser(cmd *m.UpsertUserCommand) error {
	extUser := cmd.ExternalUser

	userQuery := &m.GetUserByAuthInfoQuery{
		AuthModule: extUser.AuthModule,
		AuthId:     extUser.AuthId,
		UserId:     extUser.UserId,
		Email:      extUser.Email,
		Login:      extUser.Login,
	}

	err := bus.Dispatch(userQuery)
	if err != m.ErrUserNotFound && err != nil {
		return err
	}

	if err != nil {
		if !cmd.SignupAllowed {
			log.Warn("Not allowing %s login, user not found in internal user database and allow signup = false", extUser.AuthModule)
			return ErrInvalidCredentials
		}

		limitReached, err := quota.QuotaReached(cmd.ReqContext, "user")
		if err != nil {
			log.Warn("Error getting user quota. error: %v", err)
			return ErrGettingUserQuota
		}
		if limitReached {
			return ErrUsersQuotaReached
		}

		cmd.Result, err = createUser(extUser)
		if err != nil {
			return err
		}

		if extUser.AuthModule != "" && extUser.AuthId != "" {
			cmd2 := &m.SetAuthInfoCommand{
				UserId:     cmd.Result.Id,
				AuthModule: extUser.AuthModule,
				AuthId:     extUser.AuthId,
			}
			if err := bus.Dispatch(cmd2); err != nil {
				return err
			}
		}

	} else {
		cmd.Result = userQuery.Result

		err = updateUser(cmd.Result, extUser)
		if err != nil {
			return err
		}
	}

	err = syncOrgRoles(cmd.Result, extUser)
	if err != nil {
		return err
	}

	// Sync isGrafanaAdmin permission
	if extUser.IsGrafanaAdmin != nil && *extUser.IsGrafanaAdmin != cmd.Result.IsAdmin {
		if err := bus.Dispatch(&m.UpdateUserPermissionsCommand{UserId: cmd.Result.Id, IsGrafanaAdmin: *extUser.IsGrafanaAdmin}); err != nil {
			return err
		}
	}

	err = bus.Dispatch(&m.SyncTeamsCommand{
		User:         cmd.Result,
		ExternalUser: extUser,
	})

	if err == bus.ErrHandlerNotFound {
		return nil
	}

	return err
}

func createUser(extUser *m.ExternalUserInfo) (*m.User, error) {
	cmd := &m.CreateUserCommand{
		Login:        extUser.Login,
		Email:        extUser.Email,
		Name:         extUser.Name,
		SkipOrgSetup: len(extUser.OrgRoles) > 0,
	}

	if err := bus.Dispatch(cmd); err != nil {
		return nil, err
	}

	return &cmd.Result, nil
}

func updateUser(user *m.User, extUser *m.ExternalUserInfo) error {
	// sync user info
	updateCmd := &m.UpdateUserCommand{
		UserId: user.Id,
	}

	needsUpdate := false
	if extUser.Login != "" && extUser.Login != user.Login {
		updateCmd.Login = extUser.Login
		user.Login = extUser.Login
		needsUpdate = true
	}

	if extUser.Email != "" && extUser.Email != user.Email {
		updateCmd.Email = extUser.Email
		user.Email = extUser.Email
		needsUpdate = true
	}

	if extUser.Name != "" && extUser.Name != user.Name {
		updateCmd.Name = extUser.Name
		user.Name = extUser.Name
		needsUpdate = true
	}

	if !needsUpdate {
		return nil
	}

	log.Debug2("Syncing user info", "id", user.Id, "update", updateCmd)
	return bus.Dispatch(updateCmd)
}

func syncOrgRoles(user *m.User, extUser *m.ExternalUserInfo) error {
	// don't sync org roles if none are specified
	if len(extUser.OrgRoles) == 0 {
		return nil
	}

	orgsQuery := &m.GetUserOrgListQuery{UserId: user.Id}
	if err := bus.Dispatch(orgsQuery); err != nil {
		return err
	}

	handledOrgIds := map[int64]bool{}
	deleteOrgIds := []int64{}

	// update existing org roles
	for _, org := range orgsQuery.Result {
		handledOrgIds[org.OrgId] = true

		if extUser.OrgRoles[org.OrgId] == "" {
			deleteOrgIds = append(deleteOrgIds, org.OrgId)
		} else if extUser.OrgRoles[org.OrgId] != org.Role {
			// update role
			cmd := &m.UpdateOrgUserCommand{OrgId: org.OrgId, UserId: user.Id, Role: extUser.OrgRoles[org.OrgId]}
			if err := bus.Dispatch(cmd); err != nil {
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
		cmd := &m.AddOrgUserCommand{UserId: user.Id, Role: orgRole, OrgId: orgId}
		err := bus.Dispatch(cmd)
		if err != nil && err != m.ErrOrgNotFound {
			return err
		}
	}

	// delete any removed org roles
	for _, orgId := range deleteOrgIds {
		cmd := &m.RemoveOrgUserCommand{OrgId: orgId, UserId: user.Id}
		if err := bus.Dispatch(cmd); err != nil {
			return err
		}
	}

	// update user's default org if needed
	if _, ok := extUser.OrgRoles[user.OrgId]; !ok {
		for orgId := range extUser.OrgRoles {
			user.OrgId = orgId
			break
		}

		return bus.Dispatch(&m.SetUsingOrgCommand{
			UserId: user.Id,
			OrgId:  user.OrgId,
		})
	}

	return nil
}
