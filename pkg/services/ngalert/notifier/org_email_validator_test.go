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

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
)

const testValidatorOrgID int64 = 7

func requesterWithOrg(orgID int64) identity.Requester {
	return &user.SignedInUser{OrgID: orgID}
}

// emailConfig builds a minimal email V1 IntegrationConfig with the given address string.
func emailConfig(addresses string) alertingModels.IntegrationConfig {
	settings, _ := json.Marshal(map[string]any{"addresses": addresses})
	return alertingModels.IntegrationConfig{
		Type:     schema.EmailType,
		Version:  schema.V1,
		Settings: settings,
	}
}

// orgHavingMember returns a FakeOrgService whose SearchOrgUsers returns the given email as an org member.
func orgHavingMember(email string) *orgtest.FakeOrgService {
	svc := orgtest.NewOrgServiceFake()
	svc.SearchOrgUsersFn = func(_ context.Context, q *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
		if strings.EqualFold(q.Query, email) {
			return &org.SearchOrgUsersQueryResult{
				TotalCount: 1,
				OrgUsers:   []*org.OrgUserDTO{{Email: email}},
			}, nil
		}
		return &org.SearchOrgUsersQueryResult{}, nil
	}
	return svc
}

// orgWithoutMember returns a FakeOrgService that finds no members for any query.
func orgWithoutMember() *orgtest.FakeOrgService {
	return &orgtest.FakeOrgService{
		ExpectedSearchOrgUsersResult: &org.SearchOrgUsersQueryResult{},
	}
}

func TestOrgUserEmailValidator_ValidateIntegrationConfig(t *testing.T) {
	disabledMember := func() *orgtest.FakeOrgService {
		svc := orgtest.NewOrgServiceFake()
		svc.SearchOrgUsersFn = func(_ context.Context, _ *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
			return &org.SearchOrgUsersQueryResult{
				TotalCount: 1,
				OrgUsers:   []*org.OrgUserDTO{{Email: "alice@org.com", IsDisabled: true}},
			}, nil
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
			wantErr: "is not an allowed recipient for this organization",
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
			wantErr: "failed to validate email address",
		},
		{
			name:   "multiple valid addresses all pass",
			config: emailConfig("alice@org.com;bob@org.com"),
			orgSvc: func() *orgtest.FakeOrgService {
				svc := orgtest.NewOrgServiceFake()
				svc.SearchOrgUsersFn = func(_ context.Context, q *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
					for _, email := range []string{"alice@org.com", "bob@org.com"} {
						if strings.EqualFold(q.Query, email) {
							return &org.SearchOrgUsersQueryResult{
								TotalCount: 1,
								OrgUsers:   []*org.OrgUserDTO{{Email: email}},
							}, nil
						}
					}
					return &org.SearchOrgUsersQueryResult{}, nil
				}
				return svc
			}(),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v := &OrgUserEmailValidator{orgSvc: tc.orgSvc}
			err := v.ValidateIntegrationConfig(context.Background(), requesterWithOrg(testValidatorOrgID), tc.config)
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
		svc.SearchOrgUsersFn = func(_ context.Context, q *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
			searchCalls++
			return &org.SearchOrgUsersQueryResult{
				TotalCount: 1,
				OrgUsers:   []*org.OrgUserDTO{{Email: q.Query}},
			}, nil
		}
		v := &OrgUserEmailValidator{orgSvc: svc}
		err := v.ValidateIntegrationConfig(context.Background(), requesterWithOrg(testValidatorOrgID), emailConfig("alice@org.com;alice@org.com"))
		require.NoError(t, err)
		require.Equal(t, 1, searchCalls)
	})

	t.Run("lookup is case-insensitive", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgHavingMember("alice@org.com")}
		err := v.ValidateIntegrationConfig(context.Background(), requesterWithOrg(testValidatorOrgID), emailConfig("Alice@Org.Com"))
		require.NoError(t, err)
	})

	t.Run("display-name format is parsed correctly", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgHavingMember("alice@org.com")}
		err := v.ValidateIntegrationConfig(context.Background(), requesterWithOrg(testValidatorOrgID), emailConfig("Alice <alice@org.com>"))
		require.NoError(t, err)
	})

	t.Run("first address valid second not in org returns error", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgHavingMember("alice@org.com")}
		err := v.ValidateIntegrationConfig(context.Background(), requesterWithOrg(testValidatorOrgID), emailConfig("alice@org.com;outsider@evil.com"))
		require.ErrorContains(t, err, "is not an allowed recipient for this organization")
	})
}

func TestOrgUserEmailValidator_ValidateIntegration(t *testing.T) {
	t.Run("non-email integration type is skipped", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgWithoutMember()}
		integration := models.IntegrationGen(models.IntegrationMuts.WithValidConfig(schema.SlackType))()
		require.NoError(t, v.ValidateIntegration(context.Background(), requesterWithOrg(testValidatorOrgID), integration))
	})

	t.Run("email V1 with org member succeeds", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgHavingMember("alice@org.com")}
		integration := models.IntegrationGen(
			models.IntegrationMuts.WithValidConfig(schema.EmailType),
			models.IntegrationMuts.WithSettings(map[string]any{"addresses": "alice@org.com"}),
		)()
		require.NoError(t, v.ValidateIntegration(context.Background(), requesterWithOrg(testValidatorOrgID), integration))
	})

	t.Run("email V1 with non-org address returns error", func(t *testing.T) {
		v := &OrgUserEmailValidator{orgSvc: orgWithoutMember()}
		integration := models.IntegrationGen(
			models.IntegrationMuts.WithValidConfig(schema.EmailType),
			models.IntegrationMuts.WithSettings(map[string]any{"addresses": "outsider@evil.com"}),
		)()
		require.ErrorContains(t, v.ValidateIntegration(context.Background(), requesterWithOrg(testValidatorOrgID), integration), "is not an allowed recipient for this organization")
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
