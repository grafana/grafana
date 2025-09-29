package user

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestValidateOnCreate(t *testing.T) {
	tests := []struct {
		name          string
		user          *iamv0alpha1.User
		requester     *identity.StaticRequester
		expectError   bool
		errorContains string
	}{
		{
			name: "valid user creation by grafana admin",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login: "testuser",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			expectError: false,
		},
		{
			name: "grafana admin creating another grafana admin",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login:        "newadmin",
					GrafanaAdmin: true,
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			expectError: false,
		},
		{
			name: "non-admin trying to create a grafana admin",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login:        "newadmin",
					GrafanaAdmin: true,
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			expectError:   true,
			errorContains: "only grafana admins can create grafana admins",
		},
		{
			name: "user with empty login and email",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			expectError:   true,
			errorContains: "user must have either login or email",
		},
		{
			name: "user with only login",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login: "testuser",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			expectError: false,
		},
		{
			name: "user with only email",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Email: "test@test.com",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := identity.WithRequester(
				context.Background(),
				tt.requester,
			)

			err := ValidateOnCreate(ctx, tt.user)

			if tt.expectError {
				require.Error(t, err)
				if tt.errorContains != "" {
					require.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}
