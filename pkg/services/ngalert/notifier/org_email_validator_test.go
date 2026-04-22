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
	"github.com/grafana/grafana/pkg/services/user/usertest"
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

// memberOf returns a FakeOrgService that reports the user as belonging to the given org IDs.
func memberOf(orgIDs ...int64) *orgtest.FakeOrgService {
	list := make([]*org.UserOrgDTO, 0, len(orgIDs))
	for _, id := range orgIDs {
		list = append(list, &org.UserOrgDTO{OrgID: id})
	}
	return &orgtest.FakeOrgService{ExpectedUserOrgDTO: list}
}

func TestOrgUserEmailValidator_ValidateIntegrationConfig(t *testing.T) {
	foundMember := &usertest.FakeUserService{ExpectedUser: &user.User{ID: 1, Email: "alice@org.com"}}
	notFound := &usertest.FakeUserService{ExpectedError: user.ErrUserNotFound}
	lookupFails := &usertest.FakeUserService{ExpectedError: errors.New("db unavailable")}
	disabled := &usertest.FakeUserService{ExpectedUser: &user.User{ID: 1, Email: "alice@org.com", IsDisabled: true}}

	inOrg := memberOf(testValidatorOrgID)
	onlyInAnotherOrg := memberOf(999)

	tests := []struct {
		name    string
		config  alertingModels.IntegrationConfig
		userSvc UserLookup
		orgSvc  OrgMembershipLookup
		wantErr string
	}{
		{
			name:    "non-email type is skipped",
			config:  alertingModels.IntegrationConfig{Type: schema.SlackType, Version: schema.V1},
			userSvc: notFound,
			orgSvc:  inOrg,
		},
		{
			name:    "non-V1 version is skipped",
			config:  alertingModels.IntegrationConfig{Type: schema.EmailType, Version: "v0"},
			userSvc: notFound,
			orgSvc:  inOrg,
		},
		{
			name:    "valid email matching org member succeeds",
			config:  emailConfig("alice@org.com"),
			userSvc: foundMember,
			orgSvc:  inOrg,
		},
		{
			name:    "email not found returns generic not-allowed error",
			config:  emailConfig("outsider@org.com"),
			userSvc: notFound,
			orgSvc:  inOrg,
			wantErr: "is not an allowed recipient for this organization",
		},
		{
			name:    "email belongs to user who is only a member of a different org is rejected",
			config:  emailConfig("alice@org.com"),
			userSvc: foundMember,
			orgSvc:  onlyInAnotherOrg,
			wantErr: "is not an allowed recipient for this organization",
		},
		{
			name:    "email belongs to disabled user who is a member of this org is rejected",
			config:  emailConfig("alice@org.com"),
			userSvc: disabled,
			orgSvc:  inOrg,
			wantErr: "is not an allowed recipient for this organization",
		},
		{
			name:    "template in address returns error",
			config:  emailConfig("{{ .OrgName }}@org.com"),
			userSvc: notFound,
			orgSvc:  inOrg,
			wantErr: "templates in email addresses are not allowed",
		},
		{
			name:    "malformed address returns error",
			config:  emailConfig("not-an-email"),
			userSvc: notFound,
			orgSvc:  inOrg,
			wantErr: "failed to parse email address",
		},
		{
			name:    "user lookup infrastructure error is returned",
			config:  emailConfig("alice@org.com"),
			userSvc: lookupFails,
			orgSvc:  inOrg,
			wantErr: "failed to validate email address",
		},
		{
			name:    "multiple valid addresses all pass",
			config:  emailConfig("alice@org.com;bob@org.com"),
			userSvc: foundMember,
			orgSvc:  inOrg,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v := &OrgUserEmailValidator{userSvc: tc.userSvc, orgSvc: tc.orgSvc}
			err := v.ValidateIntegrationConfig(context.Background(), requesterWithOrg(testValidatorOrgID), tc.config)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
			} else {
				require.NoError(t, err)
			}
		})
	}

	t.Run("email belongs to user who is a member of both orgs succeeds", func(t *testing.T) {
		userSvc := &usertest.FakeUserService{ExpectedUser: &user.User{ID: 1, Email: "alice@org.com"}}
		orgSvc := memberOf(1, 2, testValidatorOrgID, 9)
		v := &OrgUserEmailValidator{userSvc: userSvc, orgSvc: orgSvc}
		err := v.ValidateIntegrationConfig(context.Background(), requesterWithOrg(testValidatorOrgID), emailConfig("alice@org.com"))
		require.NoError(t, err)
	})

	t.Run("duplicate addresses are checked only once", func(t *testing.T) {
		var userCalls int
		userSvc := usertest.NewUserServiceFake()
		userSvc.GetByEmailFn = func(_ context.Context, q *user.GetUserByEmailQuery) (*user.User, error) {
			userCalls++
			return &user.User{ID: 1, Email: q.Email}, nil
		}
		v := &OrgUserEmailValidator{userSvc: userSvc, orgSvc: memberOf(testValidatorOrgID)}
		err := v.ValidateIntegrationConfig(context.Background(), requesterWithOrg(testValidatorOrgID), emailConfig("alice@org.com;alice@org.com"))
		require.NoError(t, err)
		require.Equal(t, 1, userCalls)
	})

	t.Run("lookup is case-insensitive", func(t *testing.T) {
		userSvc := usertest.NewUserServiceFake()
		userSvc.GetByEmailFn = func(_ context.Context, q *user.GetUserByEmailQuery) (*user.User, error) {
			if strings.EqualFold(q.Email, "alice@org.com") {
				return &user.User{ID: 1, Email: "alice@org.com"}, nil
			}
			return nil, user.ErrUserNotFound
		}
		v := &OrgUserEmailValidator{userSvc: userSvc, orgSvc: memberOf(testValidatorOrgID)}
		err := v.ValidateIntegrationConfig(context.Background(), requesterWithOrg(testValidatorOrgID), emailConfig("Alice@Org.Com"))
		require.NoError(t, err)
	})

	t.Run("display-name format is parsed correctly", func(t *testing.T) {
		userSvc := usertest.NewUserServiceFake()
		userSvc.GetByEmailFn = func(_ context.Context, q *user.GetUserByEmailQuery) (*user.User, error) {
			if q.Email == "alice@org.com" {
				return &user.User{ID: 1, Email: "alice@org.com"}, nil
			}
			return nil, user.ErrUserNotFound
		}
		v := &OrgUserEmailValidator{userSvc: userSvc, orgSvc: memberOf(testValidatorOrgID)}
		err := v.ValidateIntegrationConfig(context.Background(), requesterWithOrg(testValidatorOrgID), emailConfig("Alice <alice@org.com>"))
		require.NoError(t, err)
	})

	t.Run("first address valid second not in org returns error", func(t *testing.T) {
		userSvc := usertest.NewUserServiceFake()
		userSvc.GetByEmailFn = func(_ context.Context, q *user.GetUserByEmailQuery) (*user.User, error) {
			if strings.EqualFold(q.Email, "alice@org.com") {
				return &user.User{ID: 1, Email: "alice@org.com"}, nil
			}
			return nil, user.ErrUserNotFound
		}
		v := &OrgUserEmailValidator{userSvc: userSvc, orgSvc: memberOf(testValidatorOrgID)}
		err := v.ValidateIntegrationConfig(context.Background(), requesterWithOrg(testValidatorOrgID), emailConfig("alice@org.com;outsider@evil.com"))
		require.ErrorContains(t, err, "is not an allowed recipient for this organization")
	})
}

func TestOrgUserEmailValidator_ValidateIntegration(t *testing.T) {
	t.Run("non-email integration type is skipped", func(t *testing.T) {
		v := &OrgUserEmailValidator{userSvc: usertest.NewUserServiceFake(), orgSvc: memberOf(testValidatorOrgID)}
		integration := models.IntegrationGen(models.IntegrationMuts.WithValidConfig(schema.SlackType))()
		require.NoError(t, v.ValidateIntegration(context.Background(), requesterWithOrg(testValidatorOrgID), integration))
	})

	t.Run("email V1 with org member succeeds", func(t *testing.T) {
		userSvc := &usertest.FakeUserService{ExpectedUser: &user.User{ID: 1, Email: "alice@org.com"}}
		v := &OrgUserEmailValidator{userSvc: userSvc, orgSvc: memberOf(testValidatorOrgID)}
		integration := models.IntegrationGen(
			models.IntegrationMuts.WithValidConfig(schema.EmailType),
			models.IntegrationMuts.WithSettings(map[string]any{"addresses": "alice@org.com"}),
		)()
		require.NoError(t, v.ValidateIntegration(context.Background(), requesterWithOrg(testValidatorOrgID), integration))
	})

	t.Run("email V1 with non-org address returns error", func(t *testing.T) {
		userSvc := &usertest.FakeUserService{ExpectedError: user.ErrUserNotFound}
		v := &OrgUserEmailValidator{userSvc: userSvc, orgSvc: memberOf(testValidatorOrgID)}
		integration := models.IntegrationGen(
			models.IntegrationMuts.WithValidConfig(schema.EmailType),
			models.IntegrationMuts.WithSettings(map[string]any{"addresses": "outsider@evil.com"}),
		)()
		require.ErrorContains(t, v.ValidateIntegration(context.Background(), requesterWithOrg(testValidatorOrgID), integration), "is not an allowed recipient for this organization")
	})
}

func TestNewEmailValidator(t *testing.T) {
	t.Run("enabled=false returns noop", func(t *testing.T) {
		v := NewEmailValidator(usertest.NewUserServiceFake(), orgtest.NewOrgServiceFake(), false)
		require.IsType(t, &NoopOrgEmailValidator{}, v)
	})

	t.Run("nil userSvc with enabled=true returns noop", func(t *testing.T) {
		v := NewEmailValidator(nil, orgtest.NewOrgServiceFake(), true)
		require.IsType(t, &NoopOrgEmailValidator{}, v)
	})

	t.Run("nil orgSvc with enabled=true returns noop", func(t *testing.T) {
		v := NewEmailValidator(usertest.NewUserServiceFake(), nil, true)
		require.IsType(t, &NoopOrgEmailValidator{}, v)
	})

	t.Run("enabled=true with both svcs returns real validator", func(t *testing.T) {
		v := NewEmailValidator(usertest.NewUserServiceFake(), orgtest.NewOrgServiceFake(), true)
		require.IsType(t, &OrgUserEmailValidator{}, v)
	})
}
