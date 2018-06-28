package login

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/quota"
)

type (
	// user sync fsm state
	userSyncState struct {
		cmd *m.UpsertUserCommand

		orgsQuery   *m.GetUserOrgListQuery
		deletedOrgs map[int64]bool // orgs user has left access to
		updatedOrgs map[int64]bool // orgs user has access

		user  *m.User
		teams map[int64]map[int64]bool // {orgId: { teamId: bool, teamId: bool, ... }, ...}

		err error // fsm error
		log log.Logger
	}

	// user sync fsm func
	userSyncStateFn func(s *userSyncState) userSyncStateFn
)

func init() {
	bus.AddHandler("auth", UpsertUser)
}

func UpsertUser(cmd *m.UpsertUserCommand) error {
	s := &userSyncState{
		cmd: cmd,
		log: log.New("upsert"),
	}

	for next := syncUserStart; next != nil; {
		next = next(s)
	}

	cmd.Result = s.user
	return s.err
}

// fsm: initialize state fields
func syncUserStart(s *userSyncState) userSyncStateFn {
	s.updatedOrgs = map[int64]bool{}
	s.deletedOrgs = map[int64]bool{}
	s.teams = map[int64]map[int64]bool{}

	return syncCheckUser
}

// fsm: try to find user in database, in case user exists just go with update phase,
// otherwise go straight to signup phase.
func syncCheckUser(s *userSyncState) userSyncStateFn {
	userQuery := &m.GetUserByAuthInfoQuery{
		AuthModule: s.cmd.ExternalUser.AuthModule,
		AuthId:     s.cmd.ExternalUser.AuthId,
		UserId:     s.cmd.ExternalUser.UserId,
		Email:      s.cmd.ExternalUser.Email,
		Login:      s.cmd.ExternalUser.Login,
	}

	err := bus.Dispatch(userQuery)
	if err != m.ErrUserNotFound && err != nil {
		s.err = err
		return nil
	}

	if err != nil {
		return syncSignupUser
	}

	s.user = userQuery.Result
	return syncUpdateUser
}

// fsm: user has not been found in database,
// check allowance of signup and quotas and proceed with user creation.
func syncSignupUser(s *userSyncState) userSyncStateFn {
	if !s.cmd.SignupAllowed {
		s.log.Warn(
			"Not allowing login, user not found in internal user database and allow signup = false",
			"auth_module", s.cmd.ExternalUser.AuthModule)

		s.err = ErrInvalidCredentials
		return nil
	}

	limitReached, err := quota.QuotaReached(s.cmd.ReqContext, "user")
	if err != nil {
		s.log.Warn("Error getting user quota", "err", err)
		s.err = ErrGettingUserQuota
		return nil
	}
	if limitReached {
		s.err = ErrUsersQuotaReached
		return nil
	}

	return syncCreateUser
}

// fsm: signup is allowed, quota limit is not hit, so, create user
// and proceed with orgs/teams membership.
func syncCreateUser(s *userSyncState) userSyncStateFn {
	createCmd := &m.CreateUserCommand{
		Login:        s.cmd.ExternalUser.Login,
		Email:        s.cmd.ExternalUser.Email,
		Name:         s.cmd.ExternalUser.Name,
		SkipOrgSetup: len(s.cmd.ExternalUser.OrgRoles) > 0,
	}

	if err := bus.Dispatch(createCmd); err != nil {
		s.err = err
		return nil
	}

	s.user = &createCmd.Result
	if s.cmd.ExternalUser.AuthModule != "" && s.cmd.ExternalUser.AuthId != "" {
		authInfoCmd := &m.SetAuthInfoCommand{
			UserId:     s.user.Id,
			AuthModule: s.cmd.ExternalUser.AuthModule,
			AuthId:     s.cmd.ExternalUser.AuthId,
		}

		if err := bus.Dispatch(authInfoCmd); err != nil {
			s.err = err
			return nil
		}
	}

	return syncUserMembershipStart
}

// fsm: user has been found in database, update user base details if needed
// and proceed with orgs/teams membership.
func syncUpdateUser(s *userSyncState) userSyncStateFn {
	needsUpdate := false
	updateCmd := &m.UpdateUserCommand{UserId: s.user.Id}

	if s.cmd.ExternalUser.Login != "" && s.cmd.ExternalUser.Login != s.user.Login {
		needsUpdate = true
		updateCmd.Login = s.cmd.ExternalUser.Login
		s.user.Login = s.cmd.ExternalUser.Login
	}

	if s.cmd.ExternalUser.Email != "" && s.cmd.ExternalUser.Email != s.user.Email {
		needsUpdate = true
		updateCmd.Email = s.cmd.ExternalUser.Email
		s.user.Email = s.cmd.ExternalUser.Email
	}

	if s.cmd.ExternalUser.Name != "" && s.cmd.ExternalUser.Name != s.user.Name {
		needsUpdate = true
		updateCmd.Name = s.cmd.ExternalUser.Name
		s.user.Name = s.cmd.ExternalUser.Name
	}

	if needsUpdate {
		s.log.Debug("Syncing user info", "user", s.user, "cmd", updateCmd)
		err := bus.Dispatch(updateCmd)
		if err != nil {
			s.err = err
			return nil
		}
	}

	return syncUserMembershipStart
}

// fsm: in order to correctly handle orgs/teams membership, permissions sync is divided
// into 4 phases:
//  - grant/update org membership ->
//  - grant team membership across all orgs user belongs to ->
//  - revoke team membership across all orgs user belongs to ->
//  - revoke org membership user left access to.
//
// before performing orgs/teams membership, make sure external
// user contains configuration for orgs, otherwise, sync is not needed.
func syncUserMembershipStart(s *userSyncState) userSyncStateFn {
	if len(s.cmd.ExternalUser.OrgRoles) == 0 {
		return nil
	}

	s.orgsQuery = &m.GetUserOrgListQuery{UserId: s.user.Id}
	if err := bus.Dispatch(s.orgsQuery); err != nil {
		s.err = err
		return nil
	}

	return syncUserOrgJoin
}

// fsm: join orgs, while joining orgs, keep track of orgs user left access to
// and proceed with team membership.
func syncUserOrgJoin(s *userSyncState) userSyncStateFn {
	for _, org := range s.orgsQuery.Result {
		orgRole, exists := s.cmd.ExternalUser.OrgRoles[org.OrgId]

		switch exists {
		case true:
			// track seen orgs user currently have in database
			s.updatedOrgs[org.OrgId] = true

			// if new role differ from current one
			if orgRole != org.Role {
				cmd := &m.UpdateOrgUserCommand{
					OrgId:  org.OrgId,
					UserId: s.user.Id,
					Role:   orgRole,
				}
				if err := bus.Dispatch(cmd); err != nil {
					s.err = err
					return nil
				}
			}
		default:
			// track orgs removed in ldap
			s.deletedOrgs[org.OrgId] = true
		}
	}

	// for orgs we have in ldap, grant every org access user don't have access to
	for orgId, orgRole := range s.cmd.ExternalUser.OrgRoles {
		// is org known to be already updated?
		if _, exists := s.updatedOrgs[orgId]; exists {
			continue
		}
		// is org known to be scheduled for deletion?
		if _, exists := s.deletedOrgs[orgId]; exists {
			continue
		}

		// track new orgs, we don't have in database yet,
		// but will be added.
		s.updatedOrgs[orgId] = true

		// add user org role
		s.log.Debug("Adding user to org", "user", s.user, "orgId", orgId, "role", orgRole)
		cmd := &m.AddOrgUserCommand{
			UserId: s.user.Id,
			Role:   orgRole,
			OrgId:  orgId,
		}
		err := bus.Dispatch(cmd)
		if err != nil && err != m.ErrOrgNotFound {
			s.err = err
			return nil
		}
	}

	return syncUserTeamsStart
}

// fsm: at this point, user still have access to all orgs, even to orgs user lost access to,
// so, loading up information about team membership and proceed with team join phase.
// if no teams configured in group mappings, skip whole join/leave phase.
func syncUserTeamsStart(s *userSyncState) userSyncStateFn {

	updatedOrgsCount := 0 // keep track of orgs updated and configured to handle team membership
	deletedOrgsCount := 0 // keep track of orgs deleted and configured to handle team membership

	for orgId := range s.updatedOrgs {
		// if team handling is not enabled for org, skip whole part
		if !s.cmd.ExternalUser.HandleTeams[orgId] {
			continue
		}

		teamQuery := &m.GetTeamsByUserQuery{OrgId: orgId, UserId: s.user.Id}
		err := bus.Dispatch(teamQuery)
		if err != nil && err != m.ErrOrgNotFound {
			s.err = err
			return nil
		}

		updatedOrgsCount++
		s.teams[orgId] = teamQueryToMap(teamQuery)
	}

	for orgId := range s.deletedOrgs {
		// if team handling is not enabled for org, skip whole part
		if !s.cmd.ExternalUser.HandleTeams[orgId] {
			continue
		}

		teamQuery := &m.GetTeamsByUserQuery{OrgId: orgId, UserId: s.user.Id}
		err := bus.Dispatch(teamQuery)
		if err != nil && err != m.ErrOrgNotFound {
			s.err = err
			return nil
		}

		deletedOrgsCount++
		s.teams[orgId] = teamQueryToMap(teamQuery)
	}

	switch true {
	case updatedOrgsCount > 0:
		// some orgs updated/seen during match phase and requires team membership handling.
		// proceed with join.
		return syncUserTeamJoin

	case deletedOrgsCount > 0:
		// no updated orgs, but some of them are removed
		// in ldap and team membership is configured for
		// them. proceed with leave.
		return syncUserTeamLeave

	default:
		// no team membership configured, skip join/leave code
		// and proceed with org leave.
		return syncUserOrgLeave
	}
}

// fsm: join all teams within orgs user have access to.
func syncUserTeamJoin(s *userSyncState) userSyncStateFn {
	for orgId := range s.updatedOrgs {
		if !s.cmd.ExternalUser.HandleTeams[orgId] {
			// skip orgs with no team membership activated
			continue
		}

		teamIdList, exists := s.cmd.ExternalUser.OrgTeams[orgId]
		if !exists {
			continue
		}

		// here, we adding teams are not registered in updated/deleted orgs
		for _, teamId := range teamIdList {
			if _, exists := s.teams[orgId][teamId]; exists {
				continue
			}

			s.log.Debug("Adding user to team", "user", s.user, "orgId", orgId, "teamId", teamId, "role")
			cmd := &m.AddTeamMemberCommand{UserId: s.user.Id, OrgId: orgId, TeamId: teamId}
			err := bus.Dispatch(cmd)
			if err != nil && err != m.ErrTeamNotFound && err != m.ErrTeamMemberAlreadyAdded {
				s.err = err
				return nil
			}
		}
	}

	return syncUserTeamLeave
}

// fsm: revoke team membership for two cases:
// - user doesn't belongs to org anymore
// - user doesn't have access to team by configuration
func syncUserTeamLeave(s *userSyncState) userSyncStateFn {
	revokeTeams := map[int64][]int64{}

	// revoke team membership by leaving orgs
	for orgId := range s.deletedOrgs {
		if !s.cmd.ExternalUser.HandleTeams[orgId] {
			// skip orgs with no team membership activated
			continue
		}

		teamIdMap, exists := s.teams[orgId]
		if !exists {
			continue
		}

		for teamId := range teamIdMap {
			revokeTeams[orgId] = append(revokeTeams[orgId], teamId)
		}
	}

	for orgId, teamIdMap := range s.teams {
		teamIdList, exists := s.cmd.ExternalUser.OrgTeams[orgId]
		if !exists {
			// user doesn't belong to org,
			// revoke membership of all teams within org
			for teamId := range teamIdMap {
				revokeTeams[orgId] = append(revokeTeams[orgId], teamId)
			}
			continue
		}

		// check that every team membership is still valid
		for teamId := range teamIdMap {
			seen := false
			for _, existTeamId := range teamIdList {
				if existTeamId == teamId {
					seen = true
					break
				}
			}

			if !seen {
				revokeTeams[orgId] = append(revokeTeams[orgId], teamId)
			}
		}
	}

	// perform revoke
	for orgId, teamIdList := range revokeTeams {
		for _, teamId := range teamIdList {
			s.log.Debug("Removing user from team", "user", s.user, "orgId", orgId, "teamId", teamId, "role")

			cmd := &m.RemoveTeamMemberCommand{UserId: s.user.Id, OrgId: orgId, TeamId: teamId}
			err := bus.Dispatch(cmd)
			if err != nil && err != m.ErrTeamNotFound && err != m.ErrTeamMemberNotFound {
				s.err = err
				return nil
			}
		}
	}

	return syncUserOrgLeave
}

// fsm: all team membership for each deleted org has been revoked,
// so just revoke access to orgs.
func syncUserOrgLeave(s *userSyncState) userSyncStateFn {
	for orgId := range s.deletedOrgs {
		s.log.Debug("Removing user from org", "user", s.user, "orgId", orgId)

		cmd := &m.RemoveOrgUserCommand{OrgId: orgId, UserId: s.user.Id}
		err := bus.Dispatch(cmd)
		if err != nil && err != m.ErrOrgNotFound {
			s.err = err
			return nil
		}
	}

	return syncUserOrgUpdateDefault
}

// fsm: if user left access to default org, update default org
// with first configured one
// (actually is quite random here, since iteration over map is not stable)
func syncUserOrgUpdateDefault(s *userSyncState) userSyncStateFn {
	if _, ok := s.cmd.ExternalUser.OrgRoles[s.user.OrgId]; !ok {
		for orgId := range s.cmd.ExternalUser.OrgRoles {
			s.user.OrgId = orgId
			break
		}

		s.log.Debug("Updating user default org", "user", s.user)
		cmd := &m.SetUsingOrgCommand{UserId: s.user.Id, OrgId: s.user.OrgId}
		if err := bus.Dispatch(cmd); err != nil {
			s.err = err
			return nil
		}
	}

	return nil
}

func teamQueryToMap(q *m.GetTeamsByUserQuery) map[int64]bool {
	r := map[int64]bool{}
	for _, team := range q.Result {
		r[team.Id] = true
	}
	return r
}
