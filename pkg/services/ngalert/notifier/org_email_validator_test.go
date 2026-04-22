package notifier

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	alertingModels "github.com/grafana/alerting/models"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
)

const testValidatorOrgID int64 = 7

// emailConfig builds a minimal email V1 IntegrationConfig with the given address string.
func emailConfig(addresses string) alertingModels.IntegrationConfig {
	settings, _ := json.Marshal(map[string]any{"addresses": addresses})
	return alertingModels.IntegrationConfig{
		Type:     schema.EmailType,
		Version:  schema.V1,
		Settings: settings,
	}
}

// orgHavingMember returns a FakeOrgService whose SearchOrgUsersByEmails returns the given email as an org member.
func orgHavingMember(email string) *orgtest.FakeOrgService {
	svc := orgtest.NewOrgServiceFake()
	svc.SearchOrgUsersByEmailsFn = func(_ context.Context, q *org.SearchOrgUsersByEmailsQuery) ([]*org.OrgUserDTO, error) {
		for _, e := range q.Emails {
			if strings.EqualFold(e, email) {
				return []*org.OrgUserDTO{{Email: email}}, nil
			}
		}
		return nil, nil
	}
	return svc
}

// orgWithoutMember returns a FakeOrgService that finds no members for any query.
func orgWithoutMember() *orgtest.FakeOrgService {
	return orgtest.NewOrgServiceFake()
}

func TestOrgUserEmailValidator_ValidateIntegrationConfig(t *testing.T) {
	disabledMember := func() *orgtest.FakeOrgService {
		svc := orgtest.NewOrgServiceFake()
		svc.SearchOrgUsersByEmailsFn = func(_ context.Context, _ *org.SearchOrgUsersByEmailsQuery) ([]*org.OrgUserDTO, error) {
			return []*org.OrgUserDTO{{Email: "alice@org.com", IsDisabled: true}}, nil
		}
		return svc
	}

	searchFails := &orgtest.FakeOrgService{ExpectedError: errors.New("db unavailable")}

	tests := []struct {
		name    string
		config  alertingModels.IntegrationConfig
		orgSvc  OrgMembershipLookup
		wantErr string
	}{
		{
			name:   "non-email type is skipped",
			config: alertingModels.IntegrationConfig{Type: schema.SlackType, Version: schema.V1},
			orgSvc: orgWithoutMember(),
		},
		{
			name:   "non-V1 version is skipped",
			config: alertingModels.IntegrationConfig{Type: schema.EmailType, Version: "v0"},
			orgSvc: orgWithoutMember(),
		},
		{
			name:   "valid email matching org member succeeds",
			config: emailConfig("alice@org.com"),
			orgSvc: orgHavingMember("alice@org.com"),
		},
		{
			name:    "email not found in org returns not-allowed error",
			config:  emailConfig("outsider@org.com"),
			orgSvc:  orgWithoutMember(),
			wantErr: "are not members of this organization",
		},
		{
			name:   "email belongs to disabled user is allowed",
			config: emailConfig("alice@org.com"),
			orgSvc: disabledMember(),
		},
		{
			name:    "template in address returns error",
			config:  emailConfig("{{ .OrgName }}@org.com"),
			orgSvc:  orgWithoutMember(),
			wantErr: "templates in email addresses are not allowed",
		},
		{
			name:    "malformed address returns error",
			config:  emailConfig("not-an-email"),
			orgSvc:  orgWithoutMember(),
			wantErr: "failed to parse email address",
		},
		{
			name:    "org search error is returned",
			config:  emailConfig("alice@org.com"),
			orgSvc:  searchFails,
			wantErr: "failed to get email addresses from organization members",
		},
		{
			name:   "multiple valid addresses all pass",
			config: emailConfig("alice@org.com;bob@org.com"),
			orgSvc: func() *orgtest.FakeOrgService {
				svc := orgtest.NewOrgServiceFake()
				svc.SearchOrgUsersByEmailsFn = func(_ context.Context, q *org.SearchOrgUsersByEmailsQuery) ([]*org.OrgUserDTO, error) {
					var result []*org.OrgUserDTO
					for _, e := range q.Emails {
						for _, member := range []string{"alice@org.com", "bob@org.com"} {
							if strings.EqualFold(e, member) {
								result = append(result, &org.OrgUserDTO{Email: member})
							}
						}
					}
					return result, nil
				}
				return svc
			}(),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v := &OrgUserEmailValidator{orgSvc: tc.orgSvc}
			err := v.ValidateIntegrationConfig(context.Background(), testValidatorOrgID, tc.config, log.NewNopLogger())
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
			} else {
				require.NoError(t, err)
			}
		})
	}

	t.Run("duplicate addresses are checked only once", func(t *testing.T) {
		var searchCalls int
		svc := orgtest.NewOrgServiceFake()
		svc.SearchOrgUsersByEmailsFn = func(_ context.Context, q *org.SearchOrgUsersByEmailsQuery) ([]*org.OrgUserDTO, error) {
			searchCalls++
			result := make([]*org.OrgUserDTO, 0, len(q.Emails))
			for _, e := range q.Emails {
				result = append(result, &org.OrgUserDTO{Email: e})
			}
			return result, nil
		}
		v := &OrgUserEmailValidator{orgSvc: svc}
		err := v.ValidateIntegrationConfig(context.Background(), testValidatorOrgID, emailConfig("alice@org.com;alice@org.com"), log.NewNopLogger())
		require.NoError(t, err)
		require.Equal(t, 1, searchCalls)
	})

	t.Run("lookup is case-insensitive", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgHavingMember("alice@org.com")}
		err := v.ValidateIntegrationConfig(context.Background(), testValidatorOrgID, emailConfig("Alice@Org.Com"), log.NewNopLogger())
		require.NoError(t, err)
	})

	t.Run("display-name format is parsed correctly", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgHavingMember("alice@org.com")}
		err := v.ValidateIntegrationConfig(context.Background(), testValidatorOrgID, emailConfig("Alice <alice@org.com>"), log.NewNopLogger())
		require.NoError(t, err)
	})

	t.Run("first address valid second not in org returns error", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgHavingMember("alice@org.com")}
		err := v.ValidateIntegrationConfig(context.Background(), testValidatorOrgID, emailConfig("alice@org.com;outsider@evil.com"), log.NewNopLogger())
		require.ErrorContains(t, err, "are not members of this organization")
	})
}

func TestOrgUserEmailValidator_ValidateIntegration(t *testing.T) {
	t.Run("non-email integration type is skipped", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgWithoutMember()}
		integration := models.IntegrationGen(models.IntegrationMuts.WithValidConfig(schema.SlackType))()
		require.NoError(t, v.ValidateIntegration(context.Background(), testValidatorOrgID, integration, log.NewNopLogger()))
	})

	t.Run("email V1 with org member succeeds", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgHavingMember("alice@org.com")}
		integration := models.IntegrationGen(
			models.IntegrationMuts.WithValidConfig(schema.EmailType),
			models.IntegrationMuts.WithSettings(map[string]any{"addresses": "alice@org.com"}),
		)()
		require.NoError(t, v.ValidateIntegration(context.Background(), testValidatorOrgID, integration, log.NewNopLogger()))
	})

	t.Run("email V1 with non-org address returns error", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgWithoutMember()}
		integration := models.IntegrationGen(
			models.IntegrationMuts.WithValidConfig(schema.EmailType),
			models.IntegrationMuts.WithSettings(map[string]any{"addresses": "outsider@evil.com"}),
		)()
		require.ErrorContains(t, v.ValidateIntegration(context.Background(), testValidatorOrgID, integration, log.NewNopLogger()), "are not members of this organization")
	})
}

func TestNewEmailValidator(t *testing.T) {
	t.Run("enabled=false returns noop", func(t *testing.T) {
		v := NewEmailValidator(orgtest.NewOrgServiceFake(), false)
		require.IsType(t, &NoopOrgEmailValidator{}, v)
	})

	t.Run("nil orgSvc with enabled=true returns noop", func(t *testing.T) {
		v := NewEmailValidator(nil, true)
		require.IsType(t, &NoopOrgEmailValidator{}, v)
	})

	t.Run("enabled=true with orgSvc returns real validator", func(t *testing.T) {
		v := NewEmailValidator(orgtest.NewOrgServiceFake(), true)
		require.IsType(t, &OrgUserEmailValidator{}, v)
	})
}
