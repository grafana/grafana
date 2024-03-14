package sync

import (
	"context"
	"errors"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideOrgSync(userService user.Service, orgService org.Service, accessControl accesscontrol.Service, cfg *setting.Cfg) *OrgSync {
	return &OrgSync{userService, orgService, accessControl, cfg, log.New("org.sync")}
}

type OrgSync struct {
	userService   user.Service
	orgService    org.Service
	accessControl accesscontrol.Service
	cfg           *setting.Cfg

	log log.Logger
}

func (s *OrgSync) SyncOrgRolesHook(ctx context.Context, id *authn.Identity, _ *authn.Request) error {
	if !id.ClientParams.SyncOrgRoles {
		return nil
	}

	ctxLogger := s.log.FromContext(ctx)

	namespace, identifier := id.GetNamespacedID()
	if namespace != authn.NamespaceUser {
		ctxLogger.Warn("Failed to sync org role, invalid namespace for identity", "id", id.ID, "namespace", namespace)
		return nil
	}

	userID, err := identity.IntIdentifier(namespace, identifier)
	if err != nil {
		ctxLogger.Warn("Failed to sync org role, invalid ID for identity", "id", id.ID, "namespace", namespace, "err", err)
		return nil
	}

	ctxLogger.Debug("Syncing organization roles", "id", id.ID, "extOrgRoles", id.OrgRoles)
	// don't sync org roles if none is specified
	if len(id.OrgRoles) == 0 {
		ctxLogger.Debug("Not syncing organization roles since external user doesn't have any", "id", id.ID)
		return nil
	}

	orgsQuery := &org.GetUserOrgListQuery{UserID: userID}
	result, err := s.orgService.GetUserOrgList(ctx, orgsQuery)
	if err != nil {
		ctxLogger.Error("Failed to get user's organizations", "id", id.ID, "error", err)
		return nil
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
				ctxLogger.Error("Failed to update active org user", "id", id.ID, "error", err)
				return err
			}
		}
	}

	orgIDs := make([]int64, 0, len(id.OrgRoles))
	// add any new org roles
	for orgId, orgRole := range id.OrgRoles {
		orgIDs = append(orgIDs, orgId)
		if _, exists := handledOrgIds[orgId]; exists {
			continue
		}

		// add role
		cmd := &org.AddOrgUserCommand{UserID: userID, Role: orgRole, OrgID: orgId}
		err := s.orgService.AddOrgUser(ctx, cmd)
		if err != nil && !errors.Is(err, org.ErrOrgNotFound) {
			ctxLogger.Error("Failed to update active org for user", "id", id.ID, "error", err)
			return err
		}
	}

	// delete any removed org roles
	for _, orgID := range deleteOrgIds {
		ctxLogger.Debug("Removing user's organization membership as part of syncing with OAuth login", "id", id.ID, "orgId", orgID)
		cmd := &org.RemoveOrgUserCommand{OrgID: orgID, UserID: userID}
		if err := s.orgService.RemoveOrgUser(ctx, cmd); err != nil {
			ctxLogger.Error("Failed to remove user from org", "id", id.ID, "orgId", orgID, "error", err)
			if errors.Is(err, org.ErrLastOrgAdmin) {
				continue
			}

			return err
		}

		if err := s.accessControl.DeleteUserPermissions(ctx, orgID, cmd.UserID); err != nil {
			ctxLogger.Error("Failed to delete permissions for user", "id", id.ID, "orgId", orgID, "error", err)
		}
	}

	// Note: sort all org ids to not make it flaky, for now we default to the lowest id
	sort.Slice(orgIDs, func(i, j int) bool { return orgIDs[i] < orgIDs[j] })
	// update user's default org if needed
	if _, ok := id.OrgRoles[id.OrgID]; !ok {
		if len(orgIDs) > 0 {
			id.OrgID = orgIDs[0]
			return s.userService.SetUsingOrg(ctx, &user.SetUsingOrgCommand{
				UserID: userID,
				OrgID:  id.OrgID,
			})
		}
	}

	return nil
}

func (s *OrgSync) SetDefaultOrgHook(ctx context.Context, currentIdentity *authn.Identity, r *authn.Request) error {
	if s.cfg.LoginDefaultOrgId < 1 || currentIdentity == nil {
		return nil
	}

	ctxLogger := s.log.FromContext(ctx)

	namespace, identifier := currentIdentity.GetNamespacedID()
	if namespace != identity.NamespaceUser {
		ctxLogger.Debug("Skipping default org sync, not a user", "namespace", namespace)
		return nil
	}

	userID, err := identity.IntIdentifier(namespace, identifier)
	if err != nil {
		ctxLogger.Debug("Skipping default org sync, invalid ID for identity", "id", currentIdentity.ID, "namespace", namespace, "err", err)
		return nil
	}

	hasAssignedToOrg, err := s.validateUsingOrg(ctx, userID, s.cfg.LoginDefaultOrgId)
	if err != nil {
		ctxLogger.Error("Skipping default org sync, failed to validate user's organizations", "id", currentIdentity.ID, "err", err)
		return nil
	}

	if !hasAssignedToOrg {
		ctxLogger.Debug("Skipping default org sync, user is not assigned to org", "id", currentIdentity.ID, "org", s.cfg.LoginDefaultOrgId)
		return nil
	}

	cmd := user.SetUsingOrgCommand{UserID: userID, OrgID: s.cfg.LoginDefaultOrgId}
	if err := s.userService.SetUsingOrg(ctx, &cmd); err != nil {
		ctxLogger.Error("Failed to set default org", "id", currentIdentity.ID, "err", err)
		return err
	}

	return nil
}

func (s *OrgSync) validateUsingOrg(ctx context.Context, userID int64, orgID int64) (bool, error) {
	query := org.GetUserOrgListQuery{UserID: userID}

	result, err := s.orgService.GetUserOrgList(ctx, &query)
	if err != nil {
		return false, fmt.Errorf("failed to get user's organizations: %w", err)
	}

	// validate that the org id in the list
	for _, other := range result {
		if other.OrgID == orgID {
			return true, nil
		}
	}
	return false, nil
}
