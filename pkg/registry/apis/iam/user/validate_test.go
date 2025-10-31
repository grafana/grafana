package user

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestValidateOnCreate(t *testing.T) {
	tests := []struct {
		name          string
		user          *iamv0alpha1.User
		requester     *identity.StaticRequester
		searchClient  resourcepb.ResourceIndexClient
		expectError   bool
		errorContains string
	}{
		{
			name: "valid user creation by grafana admin",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login: "testuser",
					Role:  "Viewer",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			searchClient: &FakeUserLegacySearchClient{},
			expectError:  false,
		},
		{
			name: "grafana admin creating another grafana admin",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login:        "newadmin",
					GrafanaAdmin: true,
					Role:         "Viewer",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			searchClient: &FakeUserLegacySearchClient{},
			expectError:  false,
		},
		{
			name: "non-admin trying to create a grafana admin",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login:        "newadmin",
					GrafanaAdmin: true,
					Role:         "Viewer",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			searchClient:  &FakeUserLegacySearchClient{},
			expectError:   true,
			errorContains: "only grafana admins can create grafana admins",
		},
		{
			name: "user with empty login and email",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Role: "Viewer",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			searchClient:  &FakeUserLegacySearchClient{},
			expectError:   true,
			errorContains: "user must have either login or email",
		},
		{
			name: "user with only login",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login: "testuser",
					Role:  "Viewer",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			searchClient: &FakeUserLegacySearchClient{},
			expectError:  false,
		},
		{
			name: "user with only email",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Email: "test@example",
					Role:  "Viewer",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			searchClient: &FakeUserLegacySearchClient{},
			expectError:  false,
		},
		{
			name: "user with empty role",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login: "testuser",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			searchClient:  &FakeUserLegacySearchClient{},
			expectError:   true,
			errorContains: "role is required",
		},
		{
			name: "user with invalid role",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login: "testuser",
					Role:  "InvalidRole",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			searchClient:  &FakeUserLegacySearchClient{},
			expectError:   true,
			errorContains: "invalid role 'InvalidRole'",
		},
		{
			name: "user with valid role",
			user: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login: "testuser",
					Role:  "Admin",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			searchClient: &FakeUserLegacySearchClient{},
			expectError:  false,
		},
		{
			name: "user with existing email",
			user: &iamv0alpha1.User{
				ObjectMeta: metav1.ObjectMeta{
					Name: "userx",
				},
				Spec: iamv0alpha1.UserSpec{
					Email: "existing@example",
					Role:  "Viewer",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			searchClient: &FakeUserLegacySearchClient{
				Users: []*user.UserSearchHitDTO{
					{Email: "existing@example"},
				},
			},
			expectError:   true,
			errorContains: "email 'existing@example' is already taken",
		},
		{
			name: "user with existing login",
			user: &iamv0alpha1.User{
				ObjectMeta: metav1.ObjectMeta{
					Name: "userx",
				},
				Spec: iamv0alpha1.UserSpec{
					Login: "existinguser",
					Email: "existinguser@example",
					Role:  "Viewer",
				},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			searchClient: &FakeUserLegacySearchClient{
				Users: []*user.UserSearchHitDTO{
					{Login: "existinguser"},
				},
			},
			expectError:   true,
			errorContains: "login 'existinguser' is already taken",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := identity.WithRequester(
				context.Background(),
				tt.requester,
			)

			err := ValidateOnCreate(ctx, tt.searchClient, tt.user)

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
		searchClient  resourcepb.ResourceIndexClient
		expectError   bool
		errorContains string
	}{
		{
			name: "un-provisioning a provisioned user",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Provisioned: true, Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Provisioned: false, Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			expectError:   true,
			errorContains: "provisioned user cannot be un-provisioned",
		},
		{
			name: "non-service user provisions a user",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Provisioned: false, Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Provisioned: true, Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			expectError:   true,
			errorContains: "only service users can provision a user",
		},
		{
			name: "service user provisions a user",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Provisioned: false, Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Provisioned: true, Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type: types.TypeAccessPolicy,
			},
			expectError: false,
		},
		{
			name: "no changes",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type: types.TypeUser,
			},
			expectError: false,
		},
		{
			name: "update with empty login and email",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "", Email: "", Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type: types.TypeUser,
			},
			expectError:   true,
			errorContains: "user must have either login or email",
		},
		{
			name: "update with only login",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Email: "test@example", Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Email: "", Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			searchClient: &FakeUserLegacySearchClient{},
			expectError:  false,
		},
		{
			name: "update with only email",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "", Email: "test@example", Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			searchClient: &FakeUserLegacySearchClient{},
			expectError:  false,
		},
		{
			name: "service user verifies email",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", EmailVerified: false, Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", EmailVerified: true, Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type: types.TypeAccessPolicy,
			},
			expectError: false,
		},
		{
			name: "non-service user verifies email",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", EmailVerified: false, Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", EmailVerified: true, Role: "Viewer"},
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
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Disabled: false, Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Disabled: true, Role: "Viewer"},
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
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Disabled: false, Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Disabled: true, Role: "Viewer"},
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
				Spec: iamv0alpha1.UserSpec{Login: "testuser", GrafanaAdmin: false, Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", GrafanaAdmin: true, Role: "Viewer"},
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
				Spec: iamv0alpha1.UserSpec{Login: "testuser", GrafanaAdmin: false, Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", GrafanaAdmin: true, Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: false,
			},
			expectError:   true,
			errorContains: "only grafana admins can change grafana admin status",
		},
		{
			name: "update to empty role",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Role: ""},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			expectError:   true,
			errorContains: "role is required",
		},
		{
			name: "update to invalid role",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Role: "InvalidRole"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			expectError:   true,
			errorContains: "invalid role 'InvalidRole'",
		},
		{
			name: "update to valid role",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Role: "Editor"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			expectError: false,
		},
		{
			name: "update with existing email",
			oldUser: &iamv0alpha1.User{
				ObjectMeta: metav1.ObjectMeta{
					Name: "userx",
				},
				Spec: iamv0alpha1.UserSpec{Email: "one@example", Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				ObjectMeta: metav1.ObjectMeta{
					Name: "userx",
				},
				Spec: iamv0alpha1.UserSpec{Email: "two@example", Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			searchClient: &FakeUserLegacySearchClient{
				Users: []*user.UserSearchHitDTO{
					{Email: "two@example"},
				},
			},
			expectError:   true,
			errorContains: "email 'two@example' is already taken",
		},
		{
			name: "update with existing login",
			oldUser: &iamv0alpha1.User{
				ObjectMeta: metav1.ObjectMeta{
					Name: "userx",
				},
				Spec: iamv0alpha1.UserSpec{Login: "one", Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				ObjectMeta: metav1.ObjectMeta{
					Name: "userx",
				},
				Spec: iamv0alpha1.UserSpec{Login: "two", Role: "Viewer"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			searchClient: &FakeUserLegacySearchClient{
				Users: []*user.UserSearchHitDTO{
					{Name: "other", UID: "uid456", Login: "two"},
				},
			},
			expectError:   true,
			errorContains: "login 'two' is already taken",
		},
		{
			name: "update with no change to login or email",
			oldUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Email: "test@example", Role: "Viewer"},
			},
			newUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{Login: "testuser", Email: "test@example", Role: "Editor"},
			},
			requester: &identity.StaticRequester{
				Type:           types.TypeUser,
				IsGrafanaAdmin: true,
			},
			searchClient: &FakeUserLegacySearchClient{
				Users: []*user.UserSearchHitDTO{
					{Login: "testuser", Email: "test@example"},
				},
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

			err := ValidateOnUpdate(ctx, tt.searchClient, tt.oldUser, tt.newUser)

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
