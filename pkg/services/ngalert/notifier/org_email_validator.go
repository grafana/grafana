package notifier

import (
	"context"
	"fmt"
	"net/mail"
	"strings"

	alertingModels "github.com/grafana/alerting/models"
	emailv1 "github.com/grafana/alerting/receivers/email/v1"
	"github.com/grafana/alerting/receivers/schema"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
)

// OrgMemberLookup is the subset of org.Service needed to check email membership.
type UserLookup interface {
	GetByEmail(context.Context, *user.GetUserByEmailQuery) (*user.User, error)
}

type EmailIntegrationValidator interface {
	ValidateIntegrationConfig(ctx context.Context, integration alertingModels.IntegrationConfig) error
	ValidateIntegration(ctx context.Context, integration models.Integration) error
}

// OrgUserEmailValidator gates email address validation against org membership.
type OrgUserEmailValidator struct {
	svc UserLookup
}

// NewEmailValidator returns a validator that checks email addresses against org members. Pass enabled=false for a no-op.
func NewEmailValidator(svc UserLookup, enabled bool) EmailIntegrationValidator {
	if enabled && svc != nil {
		return &OrgUserEmailValidator{svc: svc}
	}
	return &NoopOrgEmailValidator{}
}

func (v *OrgUserEmailValidator) ValidateIntegration(ctx context.Context, integration models.Integration) error {
	if integration.Config.Type() != schema.EmailType || integration.Config.Version != schema.V1 { // TODO support v0
		return nil
	}
	cfg, err := IntegrationToIntegrationConfig(integration)
	if err != nil {
		return fmt.Errorf("failed to convert integration to integration config: %w", err)
	}
	return v.ValidateIntegrationConfig(ctx, cfg)
}

func (v *OrgUserEmailValidator) ValidateIntegrationConfig(ctx context.Context, integration alertingModels.IntegrationConfig) error {
	if integration.Type != schema.EmailType || integration.Version != schema.V1 { // TODO support v0
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

		usr, err := v.svc.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: lowerAddr})
		if err != nil {
			return fmt.Errorf("failed to check if email address %q exists: %w", addr.Address, err)
		}
		if usr == nil {
			return fmt.Errorf("email address %q is not allowed because it is not part of the organization", addr.Address)
		}
		checked[lowerAddr] = struct{}{}
	}
	return nil
}

type NoopOrgEmailValidator struct{}

func (v *NoopOrgEmailValidator) ValidateIntegrationConfig(_ context.Context, _ alertingModels.IntegrationConfig) error {
	return nil
}

func (v *NoopOrgEmailValidator) ValidateIntegration(_ context.Context, _ models.Integration) error {
	return nil
}
