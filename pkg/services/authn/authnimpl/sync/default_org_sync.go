package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type DefaultOrgSync struct {
	cfg         *setting.Cfg
	logger      log.Logger
	userService user.Service
	orgService  org.Service
}

// ProvideDefaultOrgSync sets the default org for a user after login.
func ProvideDefaultOrgSync(cfg *setting.Cfg, userService user.Service, orgService org.Service) *DefaultOrgSync {
	return &DefaultOrgSync{
		cfg:         cfg,
		logger:      log.New("authn.default_org_sync"),
		userService: userService,
		orgService:  orgService,
	}
}

func (s *DefaultOrgSync) SetDefaultOrg(ctx context.Context, currentIdentity *authn.Identity, r *authn.Request) error {
	if s.cfg.LoginDefaultOrgId < 1 || currentIdentity == nil {
		return nil
	}

	ctxLogger := s.logger.FromContext(ctx)

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

	if !s.validateUsingOrg(ctx, userID, s.cfg.LoginDefaultOrgId) {
		ctxLogger.Debug("Skipping default org sync, user is not assigned to org", "id", currentIdentity.ID, "org", s.cfg.LoginDefaultOrgId)
		return nil
	}

	cmd := user.SetUsingOrgCommand{UserID: userID, OrgID: s.cfg.LoginDefaultOrgId}
	if err := s.userService.SetUsingOrg(ctx, &cmd); err != nil {
		ctxLogger.Warn("Failed to set default org", "id", currentIdentity.ID, "err", err)
		return err
	}

	return nil
}

func (h *DefaultOrgSync) validateUsingOrg(ctx context.Context, userID int64, orgID int64) bool {
	query := org.GetUserOrgListQuery{UserID: userID}

	result, err := h.orgService.GetUserOrgList(ctx, &query)
	if err != nil {
		return false
	}

	// validate that the org id in the list
	valid := false
	for _, other := range result {
		if other.OrgID == orgID {
			valid = true
		}
	}

	return valid
}
