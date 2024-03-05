package authnimpl

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type DefaultOrgHook struct {
	cfg         *setting.Cfg
	userService user.Service
	orgService  org.Service
}

func NewDefaultOrgHook(cfg *setting.Cfg, userService user.Service, orgService org.Service) *DefaultOrgHook {
	return &DefaultOrgHook{
		cfg:         cfg,
		userService: userService,
		orgService:  orgService,
	}
}

func (h *DefaultOrgHook) SetDefaultOrg(ctx context.Context,
	currentIdentity *authn.Identity, r *authn.Request, err error) {
	if err != nil || h.cfg.LoginDefaultOrgId == -1 {
		return
	}

	namespace, identifier := currentIdentity.GetNamespacedID()
	if namespace != identity.NamespaceUser {
		return
	}

	userID, err := identity.IntIdentifier(namespace, identifier)
	if err != nil {
		return
	}

	if !h.validateUsingOrg(ctx, userID, int64(h.cfg.LoginDefaultOrgId)) {
		err = fmt.Errorf("user does not have access to default org")
	}

	cmd := user.SetUsingOrgCommand{UserID: userID, OrgID: int64(h.cfg.LoginDefaultOrgId)}

	if err := h.userService.SetUsingOrg(ctx, &cmd); err != nil {
		err = fmt.Errorf("failed to set default org: %v", err)
	}
}

func (h *DefaultOrgHook) validateUsingOrg(ctx context.Context, userID int64, orgID int64) bool {
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
