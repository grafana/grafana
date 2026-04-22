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

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
)

// OrgMembershipLookup returns the orgs a user belongs to via the org_user join
// table, which is the source of truth for membership (distinct from
// user.OrgID, which only tracks the user's default/current org).
type OrgMembershipLookup interface {
	SearchOrgUsersByEmails(ctx context.Context, query *org.SearchOrgUsersByEmailsQuery) ([]*org.OrgUserDTO, error)
}

type EmailIntegrationValidator interface {
	ValidateIntegrationConfig(ctx context.Context, requester identity.Requester, integration alertingModels.IntegrationConfig) error
	ValidateIntegration(ctx context.Context, requester identity.Requester, integration models.Integration) error
}

// OrgUserEmailValidator gates email address validation against org membership.
type OrgUserEmailValidator struct {
	orgSvc OrgMembershipLookup
}

// NewEmailValidator returns a validator that checks email addresses against org members. Pass enabled=false for a no-op.
func NewEmailValidator(orgSvc OrgMembershipLookup, enabled bool) EmailIntegrationValidator {
	if enabled && orgSvc != nil {
		return &OrgUserEmailValidator{orgSvc: orgSvc}
	}
	return &NoopOrgEmailValidator{}
}

func (v *OrgUserEmailValidator) ValidateIntegration(ctx context.Context, requester identity.Requester, integration models.Integration) error {
	if integration.Config.Type() != schema.EmailType || integration.Config.Version != schema.V1 { // TODO: support v0
		return nil
	}
	cfg, err := IntegrationToIntegrationConfig(integration)
	if err != nil {
		return fmt.Errorf("failed to convert integration to integration config: %w", err)
	}
	return v.ValidateIntegrationConfig(ctx, requester, cfg)
}

func (v *OrgUserEmailValidator) ValidateIntegrationConfig(ctx context.Context, requester identity.Requester, integration alertingModels.IntegrationConfig) error {
	if integration.Type != schema.EmailType || integration.Version != schema.V1 { // TODO: support v0
		return nil
	}
	cfg, err := emailv1.NewConfig(integration.Settings, nil)
	if err != nil {
		return fmt.Errorf("failed to parse email settings: %w", err)
	}

	// pending maps lowercase email to its original display form.
	// It doubles as a dedup set and tracks which addresses haven't been matched yet.
	pending := make(map[string]string, len(cfg.Addresses))
	emails := make([]string, 0, len(cfg.Addresses))
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
		lower := strings.ToLower(addr.Address)
		if _, ok := pending[lower]; !ok {
			pending[lower] = addr.Address
			emails = append(emails, lower)
		}
	}

	if len(emails) == 0 {
		return nil
	}
	members, err := v.orgSvc.SearchOrgUsersByEmails(ctx, &org.SearchOrgUsersByEmailsQuery{
		OrgID:              requester.GetOrgID(),
		Emails:             emails,
		ExcludeHiddenUsers: true,
	})
	if err != nil {
		return fmt.Errorf("failed to get email addresses from organization members: %w", err)
	}
	for _, m := range members {
		delete(pending, strings.ToLower(m.Email))
	}
	if len(pending) > 0 {
		return errors.New("one or many email addresses specified in the integration are not members of this organization")
	}
	return nil
}

type NoopOrgEmailValidator struct{}

func (v *NoopOrgEmailValidator) ValidateIntegrationConfig(_ context.Context, _ identity.Requester, _ alertingModels.IntegrationConfig) error {
	return nil
}

func (v *NoopOrgEmailValidator) ValidateIntegration(_ context.Context, _ identity.Requester, _ models.Integration) error {
	return nil
}
