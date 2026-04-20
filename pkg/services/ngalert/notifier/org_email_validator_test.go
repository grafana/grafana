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

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
)

// emailConfig builds a minimal email V1 IntegrationConfig with the given address string.
func emailConfig(addresses string) alertingModels.IntegrationConfig {
	settings, _ := json.Marshal(map[string]any{"addresses": addresses})
	return alertingModels.IntegrationConfig{
		Type:     schema.EmailType,
		Version:  schema.V1,
		Settings: settings,
	}
}

func TestOrgUserEmailValidator_ValidateIntegrationConfig(t *testing.T) {
	found := &usertest.FakeUserService{ExpectedUser: &user.User{Email: "alice@org.com"}}
	notFound := usertest.NewUserServiceFake() // ExpectedUser nil → not in org
	lookupFails := &usertest.FakeUserService{ExpectedError: errors.New("db unavailable")}

	tests := []struct {
		name    string
		config  alertingModels.IntegrationConfig
		svc     *usertest.FakeUserService
		wantErr string
	}{
		{
			name:   "non-email type is skipped",
			config: alertingModels.IntegrationConfig{Type: schema.SlackType, Version: schema.V1},
			svc:    notFound,
		},
		{
			name:   "non-V1 version is skipped",
			config: alertingModels.IntegrationConfig{Type: schema.EmailType, Version: "v0"},
			svc:    notFound,
		},
		{
			name:   "valid email matching org member succeeds",
			config: emailConfig("alice@org.com"),
			svc:    found,
		},
		{
			name:    "email not in org returns error",
			config:  emailConfig("outsider@org.com"),
			svc:     notFound,
			wantErr: "not allowed because it is not part of the organization",
		},
		{
			name:    "template in address returns error",
			config:  emailConfig("{{ .OrgName }}@org.com"),
			svc:     notFound,
			wantErr: "templates in email addresses are not allowed",
		},
		{
			name:    "malformed address returns error",
			config:  emailConfig("not-an-email"),
			svc:     notFound,
			wantErr: "failed to parse email address",
		},
		{
			name:    "lookup error is returned",
			config:  emailConfig("alice@org.com"),
			svc:     lookupFails,
			wantErr: "failed to check if email address",
		},
		{
			name:   "multiple valid addresses all pass",
			config: emailConfig("alice@org.com;bob@org.com"),
			svc:    found, // returns non-nil for any email
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v := &OrgUserEmailValidator{svc: tc.svc}
			err := v.ValidateIntegrationConfig(context.Background(), tc.config)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
			} else {
				require.NoError(t, err)
			}
		})
	}

	t.Run("duplicate addresses are checked only once", func(t *testing.T) {
		var calls int
		svc := usertest.NewUserServiceFake()
		svc.GetByEmailFn = func(_ context.Context, q *user.GetUserByEmailQuery) (*user.User, error) {
			calls++
			return &user.User{Email: q.Email}, nil
		}
		v := &OrgUserEmailValidator{svc: svc}
		err := v.ValidateIntegrationConfig(context.Background(), emailConfig("alice@org.com;alice@org.com"))
		require.NoError(t, err)
		require.Equal(t, 1, calls)
	})

	t.Run("lookup is case-insensitive", func(t *testing.T) {
		svc := usertest.NewUserServiceFake()
		svc.GetByEmailFn = func(_ context.Context, q *user.GetUserByEmailQuery) (*user.User, error) {
			if strings.EqualFold(q.Email, "alice@org.com") {
				return &user.User{Email: "alice@org.com"}, nil
			}
			return nil, nil
		}
		v := &OrgUserEmailValidator{svc: svc}
		err := v.ValidateIntegrationConfig(context.Background(), emailConfig("Alice@Org.Com"))
		require.NoError(t, err)
	})

	t.Run("display-name format is parsed correctly", func(t *testing.T) {
		svc := usertest.NewUserServiceFake()
		svc.GetByEmailFn = func(_ context.Context, q *user.GetUserByEmailQuery) (*user.User, error) {
			if q.Email == "alice@org.com" {
				return &user.User{Email: "alice@org.com"}, nil
			}
			return nil, nil
		}
		v := &OrgUserEmailValidator{svc: svc}
		err := v.ValidateIntegrationConfig(context.Background(), emailConfig("Alice <alice@org.com>"))
		require.NoError(t, err)
	})

	t.Run("first address valid second not in org returns error", func(t *testing.T) {
		svc := usertest.NewUserServiceFake()
		svc.GetByEmailFn = func(_ context.Context, q *user.GetUserByEmailQuery) (*user.User, error) {
			if strings.EqualFold(q.Email, "alice@org.com") {
				return &user.User{Email: "alice@org.com"}, nil
			}
			return nil, nil
		}
		v := &OrgUserEmailValidator{svc: svc}
		err := v.ValidateIntegrationConfig(context.Background(), emailConfig("alice@org.com;outsider@evil.com"))
		require.ErrorContains(t, err, "not allowed because it is not part of the organization")
	})
}

func TestOrgUserEmailValidator_ValidateIntegration(t *testing.T) {
	t.Run("non-email integration type is skipped", func(t *testing.T) {
		svc := usertest.NewUserServiceFake()
		v := &OrgUserEmailValidator{svc: svc}
		integration := models.IntegrationGen(models.IntegrationMuts.WithValidConfig(schema.SlackType))()
		require.NoError(t, v.ValidateIntegration(context.Background(), integration))
	})

	t.Run("email V1 with org member succeeds", func(t *testing.T) {
		svc := &usertest.FakeUserService{ExpectedUser: &user.User{Email: "alice@org.com"}}
		v := &OrgUserEmailValidator{svc: svc}
		integration := models.IntegrationGen(
			models.IntegrationMuts.WithValidConfig(schema.EmailType),
			models.IntegrationMuts.WithSettings(map[string]any{"addresses": "alice@org.com"}),
		)()
		require.NoError(t, v.ValidateIntegration(context.Background(), integration))
	})

	t.Run("email V1 with non-org address returns error", func(t *testing.T) {
		svc := usertest.NewUserServiceFake()
		v := &OrgUserEmailValidator{svc: svc}
		integration := models.IntegrationGen(
			models.IntegrationMuts.WithValidConfig(schema.EmailType),
			models.IntegrationMuts.WithSettings(map[string]any{"addresses": "outsider@evil.com"}),
		)()
		require.ErrorContains(t, v.ValidateIntegration(context.Background(), integration), "not allowed because it is not part of the organization")
	})
}

func TestNewEmailValidator(t *testing.T) {
	t.Run("enabled=false returns noop", func(t *testing.T) {
		v := NewEmailValidator(usertest.NewUserServiceFake(), false)
		require.IsType(t, &NoopOrgEmailValidator{}, v)
	})

	t.Run("nil svc with enabled=true returns noop", func(t *testing.T) {
		v := NewEmailValidator(nil, true)
		require.IsType(t, &NoopOrgEmailValidator{}, v)
	})

	t.Run("enabled=true with svc returns real validator", func(t *testing.T) {
		v := NewEmailValidator(usertest.NewUserServiceFake(), true)
		require.IsType(t, &OrgUserEmailValidator{}, v)
	})
}
