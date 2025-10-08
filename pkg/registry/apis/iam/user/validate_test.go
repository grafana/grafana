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

func TestValidateOnUpdate(t *testing.T) {
	tests := []struct {
		name          string
		oldUser       *iamv0alpha1.User
		newUser       *iamv0alpha1.User
		requester     *identity.StaticRequester
		expectError   bool
		errorContains string
	}{
		{
			name: "grafana admin updates user email",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Email: "old@test.com"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Email: "new@test.com"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			expectError: false,
		},
		{
			name: "non-admin updates user email",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Email: "old@test.com"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Email: "new@test.com"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			expectError:   true,
			errorContains: "only grafana admins can update email, name, or login",
		},
		{
			name: "service user updates provisioned status",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Provisioned: false},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Provisioned: true},
			},
			requester: &identity.StaticRequester{
				Type: types.TypeAccessPolicy,
			},
			expectError: false,
		},
		{
			name: "non-service user updates provisioned status",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Provisioned: false},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Provisioned: true},
			},
			requester: &identity.StaticRequester{
				Type: types.TypeUser,
			},
			expectError:   true,
			errorContains: "only service users can update provisioned status",
		},
		{
			name: "no changes",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser"},
			},
			requester: &identity.StaticRequester{
				Type: types.TypeUser,
			},
			expectError: false,
		},
		{
			name: "service user verifies email",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{EmailVerified: false},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{EmailVerified: true},
			},
			requester: &identity.StaticRequester{
				Type: types.TypeAccessPolicy,
			},
			expectError: false,
		},
		{
			name: "non-service user verifies email",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{EmailVerified: false},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{EmailVerified: true},
			},
			requester: &identity.StaticRequester{
				Type: types.TypeUser,
			},
			expectError:   true,
			errorContains: "only service users can verify email",
		},
		{
			name: "grafana admin disables user",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Disabled: false},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Disabled: true},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			expectError: false,
		},
		{
			name: "non-admin disables user",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Disabled: false},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Disabled: true},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			expectError:   true,
			errorContains: "only grafana admins can disable or enable a user",
		},
		{
			name: "grafana admin grants admin",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{GrafanaAdmin: false},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{GrafanaAdmin: true},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			expectError: false,
		},
		{
			name: "non-admin grants admin",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{GrafanaAdmin: false},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{GrafanaAdmin: true},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			expectError:   true,
			errorContains: "only grafana admins can change grafana admin status",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := identity.WithRequester(
				context.Background(),
				tt.requester,
			)

			err := ValidateOnUpdate(ctx, tt.oldUser, tt.newUser)

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
