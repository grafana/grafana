package usersync

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

type OrgSync struct {
	userService   user.Service
	orgService    org.Service
	accessControl accesscontrol.Service

	log log.Logger
}

func (s *OrgSync) SyncOrgUser(ctx context.Context, clientParams *authn.ClientParams, id *authn.Identity) error {
	if !clientParams.SyncUser {
		s.log.Debug("Not syncing org user", "auth_module", id.AuthModule, "auth_id", id.AuthID)
		return nil
	}

	namespace, userID := id.NamespacedID()
	if namespace != "user" {
		return fmt.Errorf("invalid namespace %q for user ID %q", namespace, userID)
	}

	s.log.Debug("Syncing organization roles", "id", userID, "extOrgRoles", id.OrgRoles)
	// don't sync org roles if none is specified
	if len(id.OrgRoles) == 0 {
		s.log.Debug("Not syncing organization roles since external user doesn't have any")
		return nil
	}

	orgsQuery := &org.GetUserOrgListQuery{UserID: userID}
	result, err := s.orgService.GetUserOrgList(ctx, orgsQuery)
	if err != nil {
		return err
	}

	handledOrgIds := map[int64]bool{}
	deleteOrgIds := []int64{}

	// update existing org roles
	for _, orga := range result {
		handledOrgIds[orga.OrgID] = true

		extRole := id.OrgRoles[orga.OrgID]
		if extRole == "" {
			deleteOrgIds = append(deleteOrgIds, orga.OrgID)
		} else if extRole != orga.Role {
			// update role
			cmd := &org.UpdateOrgUserCommand{OrgID: orga.OrgID, UserID: userID, Role: extRole}
			if err := s.orgService.UpdateOrgUser(ctx, cmd); err != nil {
				return err
			}
		}
	}

	// add any new org roles
	for orgId, orgRole := range id.OrgRoles {
		if _, exists := handledOrgIds[orgId]; exists {
			continue
		}

		// add role
		cmd := &org.AddOrgUserCommand{UserID: userID, Role: orgRole, OrgID: orgId}
		err := s.orgService.AddOrgUser(ctx, cmd)
		if err != nil && !errors.Is(err, models.ErrOrgNotFound) {
			return err
		}
	}

	// delete any removed org roles
	for _, orgId := range deleteOrgIds {
		s.log.Debug("Removing user's organization membership as part of syncing with OAuth login",
			"userId", userID, "orgId", orgId)
		cmd := &org.RemoveOrgUserCommand{OrgID: orgId, UserID: userID}
		if err := s.orgService.RemoveOrgUser(ctx, cmd); err != nil {
			if errors.Is(err, models.ErrLastOrgAdmin) {
				logger.Error(err.Error(), "userId", cmd.UserID, "orgId", cmd.OrgID)
				continue
			}
			if err := s.accessControl.DeleteUserPermissions(ctx, orgId, cmd.UserID); err != nil {
				logger.Warn("failed to delete permissions for user", "userID", cmd.UserID, "orgID", orgId)
			}

			return err
		}
	}

	// update user's default org if needed
	if _, ok := id.OrgRoles[id.OrgID]; !ok {
		for orgId := range id.OrgRoles {
			id.OrgID = orgId
			break
		}

		return s.userService.SetUsingOrg(ctx, &user.SetUsingOrgCommand{
			UserID: userID,
			OrgID:  id.OrgID,
		})
	}

	return nil
}
