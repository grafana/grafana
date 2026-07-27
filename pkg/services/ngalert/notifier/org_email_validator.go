package notifier

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"

	alertingModels "github.com/grafana/alerting/models"
	emailV0 "github.com/grafana/alerting/receivers/email/v0mimir1"
	emailv1 "github.com/grafana/alerting/receivers/email/v1"
	"github.com/grafana/alerting/receivers/schema"

	"github.com/grafana/grafana/pkg/infra/log"
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
	ValidateIntegrationConfig(ctx context.Context, orgID int64, integration alertingModels.IntegrationConfig, logger log.Logger) error
	ValidateIntegration(ctx context.Context, orgID int64, integration models.Integration, decryptFn models.DecryptFn, logger log.Logger) error
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

func (v *OrgUserEmailValidator) ValidateIntegration(ctx context.Context, orgID int64, integration models.Integration, decryptFn models.DecryptFn, logger log.Logger) error {
	if integration.Config.Type() != schema.EmailType {
		return nil
	}
	// Decrypt secure settings into a clone so the version parsers can read them as plain settings.
	decrypted := integration.Clone()
	if err := decrypted.Decrypt(decryptFn); err != nil {
		return fmt.Errorf("failed to decrypt integration secure settings: %w", err)
	}
	cfg, err := IntegrationToIntegrationConfig(decrypted)
	if err != nil {
		return fmt.Errorf("failed to convert integration to integration config: %w", err)
	}
	return v.ValidateIntegrationConfig(ctx, orgID, cfg, logger)
}

// ValidateIntegrationConfig checks the integration's email addresses against org membership.
// It expects any secure settings to already be decrypted into integration.Settings.
func (v *OrgUserEmailValidator) ValidateIntegrationConfig(ctx context.Context, orgID int64, integration alertingModels.IntegrationConfig, logger log.Logger) error {
	if integration.Type != schema.EmailType {
		return nil
	}
	var addrs []*mail.Address
	switch integration.Version {
	case schema.V1:
		cfg, err := emailv1.NewConfig(integration.Settings, nil)
		if err != nil {
			return fmt.Errorf("failed to parse email settings: %w", err)
		}
		addrs = make([]*mail.Address, 0, len(cfg.Addresses))
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
			addrs = append(addrs, addr)
		}
	case schema.V0mimir1:
		// Secure settings are already decrypted into the settings by the caller, so no decryption
		// is needed here. v0mimir1's NewConfig dereferences the decrypt func unconditionally (unlike
		// v1's), so pass a no-op that returns the fallback rather than nil, which would panic.
		noDecrypt := func(_, fallback string) (string, bool) { return fallback, false }
		cfg, err := emailV0.NewConfig(integration.Settings, noDecrypt)
		if err != nil {
			return fmt.Errorf("failed to parse email settings: %w", err)
		}
		if strings.Contains(cfg.To, "{{") {
			return fmt.Errorf("templates in email addresses are not allowed when validating against organization members")
		}
		addrs, err = mail.ParseAddressList(cfg.To)
		if err != nil {
			return fmt.Errorf("parse 'to' addresses: %w", err)
		}
	default:
		return fmt.Errorf("unsupported email integration version: %s", integration.Version)
	}

	// pending maps lowercase email to its original display form.
	// It doubles as a dedup set and tracks which addresses haven't been matched yet.
	pending := make(map[string]string, len(addrs))
	emails := make([]string, 0, len(addrs))
	for _, addr := range addrs {
		lower := strings.ToLower(addr.Address)
		if _, ok := pending[lower]; ok {
			continue
		}
		pending[lower] = addr.Address
		emails = append(emails, lower)
	}

	if len(emails) == 0 {
		return nil
	}
	l := logger.New("component", "email-integration-validator")
	l.Info("Validating email addresses against organization members", "emails", len(emails))
	members, err := v.orgSvc.SearchOrgUsersByEmails(ctx, &org.SearchOrgUsersByEmailsQuery{
		OrgID:              orgID,
		Emails:             emails,
		ExcludeHiddenUsers: true,
	})
	if err != nil {
		return fmt.Errorf("failed to get email addresses from organization members: %w", err)
	}
	l.Debug("Found organization members by emails", "emails", len(emails), "members", len(members))
	for _, m := range members {
		delete(pending, strings.ToLower(m.Email))
	}
	if len(pending) > 0 {
		return errors.New("one or many email addresses specified in the integration are not members of this organization")
	}
	return nil
}

type NoopOrgEmailValidator struct{}

func (v *NoopOrgEmailValidator) ValidateIntegrationConfig(_ context.Context, _ int64, _ alertingModels.IntegrationConfig, _ log.Logger) error {
	return nil
}

func (v *NoopOrgEmailValidator) ValidateIntegration(_ context.Context, _ int64, _ models.Integration, _ models.DecryptFn, _ log.Logger) error {
	return nil
}
