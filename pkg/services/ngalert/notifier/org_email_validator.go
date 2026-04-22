package notifier

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"

	alertingModels "github.com/grafana/alerting/models"
	emailv1 "github.com/grafana/alerting/receivers/email/v1"
	"github.com/grafana/alerting/receivers/schema"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

// UserLookup resolves a user by email. Service accounts are excluded by the
// underlying store, so their addresses are treated as non-members.
type UserLookup interface {
	GetByEmail(context.Context, *user.GetUserByEmailQuery) (*user.User, error)
}

// OrgMembershipLookup returns the orgs a user belongs to via the org_user join
// table, which is the source of truth for membership (distinct from
// user.OrgID, which only tracks the user's default/current org).
type OrgMembershipLookup interface {
	GetUserOrgList(context.Context, *org.GetUserOrgListQuery) ([]*org.UserOrgDTO, error)
}

type EmailIntegrationValidator interface {
	ValidateIntegrationConfig(ctx context.Context, orgID int64, integration alertingModels.IntegrationConfig) error
	ValidateIntegration(ctx context.Context, orgID int64, integration models.Integration) error
}

// OrgUserEmailValidator gates email address validation against org membership.
type OrgUserEmailValidator struct {
	userSvc UserLookup
	orgSvc  OrgMembershipLookup
}

// NewEmailValidator returns a validator that checks email addresses against org members. Pass enabled=false for a no-op.
func NewEmailValidator(userSvc UserLookup, orgSvc OrgMembershipLookup, enabled bool) EmailIntegrationValidator {
	if enabled && userSvc != nil && orgSvc != nil {
		return &OrgUserEmailValidator{userSvc: userSvc, orgSvc: orgSvc}
	}
	return &NoopOrgEmailValidator{}
}

func (v *OrgUserEmailValidator) ValidateIntegration(ctx context.Context, orgID int64, integration models.Integration) error {
	if integration.Config.Type() != schema.EmailType || integration.Config.Version != schema.V1 { // TODO: support v0
		return nil
	}
	cfg, err := IntegrationToIntegrationConfig(integration)
	if err != nil {
		return fmt.Errorf("failed to convert integration to integration config: %w", err)
	}
	return v.ValidateIntegrationConfig(ctx, orgID, cfg)
}

func (v *OrgUserEmailValidator) ValidateIntegrationConfig(ctx context.Context, orgID int64, integration alertingModels.IntegrationConfig) error {
	if integration.Type != schema.EmailType || integration.Version != schema.V1 { // TODO: support v0
		return nil
	}
	cfg, err := emailv1.NewConfig(integration.Settings, nil)
	if err != nil {
		return fmt.Errorf("failed to parse email settings: %w", err)
	}
	checked := make(map[string]struct{}, len(cfg.Addresses))
	for _, address := range cfg.Addresses {
		if address == "" {
			continue
		}
		if strings.Contains(address, "{{") {
			return fmt.Errorf("templates in email addresses are not allowed when validating against organization members")
		}
		addr, err := mail.ParseAddress(address)
		if err != nil {
			return fmt.Errorf("failed to parse email address %q: %w", address, err)
		}
		lowerAddr := strings.ToLower(addr.Address)
		if _, ok := checked[lowerAddr]; ok {
			continue
		}

		usr, err := v.userSvc.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: lowerAddr})
		if err != nil {
			if errors.Is(err, user.ErrUserNotFound) {
				return fmt.Errorf("email address %q is not allowed because it is not part of the organization", addr.Address)
			}
			return fmt.Errorf("failed to check if email address %q exists: %w", addr.Address, err)
		}
		if usr == nil {
			return fmt.Errorf("email address %q is not allowed because it is not part of the organization", addr.Address)
		}
		if usr.IsDisabled {
			return fmt.Errorf("email address %q is not allowed because the user is disabled", addr.Address)
		}

		orgs, err := v.orgSvc.GetUserOrgList(ctx, &org.GetUserOrgListQuery{UserID: usr.ID})
		if err != nil {
			return fmt.Errorf("failed to check organization membership for email address %q: %w", addr.Address, err)
		}
		isMember := false
		for _, o := range orgs {
			if o.OrgID == orgID {
				isMember = true
				break
			}
		}
		if !isMember {
			return fmt.Errorf("email address %q is not allowed because it is not part of the organization", addr.Address)
		}
		checked[lowerAddr] = struct{}{}
	}
	return nil
}

type NoopOrgEmailValidator struct{}

func (v *NoopOrgEmailValidator) ValidateIntegrationConfig(_ context.Context, _ int64, _ alertingModels.IntegrationConfig) error {
	return nil
}

func (v *NoopOrgEmailValidator) ValidateIntegration(_ context.Context, _ int64, _ models.Integration) error {
	return nil
}
