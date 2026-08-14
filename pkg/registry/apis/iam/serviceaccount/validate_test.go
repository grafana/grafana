package serviceaccount

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

func TestValidateOnCreate(t *testing.T) {
	tests := []struct {
		name           string
		serviceAccount *iamv0alpha1.ServiceAccount
		requester      *identity.StaticRequester
		expectError    bool
		errorContains  string
	}{
		{
			name: "valid service account with user requester",
			serviceAccount: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title: "Test Service Account",
					Role:  iamv0alpha1.ServiceAccountOrgRoleViewer,
				},
			},
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError: false,
		},
		{
			name: "empty title",
			serviceAccount: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title: "",
					Role:  iamv0alpha1.ServiceAccountOrgRoleViewer,
				},
			},
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "service account must have a title",
		},
		{
			name: "invalid role",
			serviceAccount: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title: "Test Service Account",
					Role:  "InvalidRole",
				},
			},
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "invalid role",
		},
		{
			name: "role higher than requester's role",
			serviceAccount: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title: "Test Service Account",
					Role:  iamv0alpha1.ServiceAccountOrgRoleAdmin,
				},
			},
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleViewer,
			},
			expectError:   true,
			errorContains: "cannot assign a role higher than user's role",
		},
		{
			name: "external service account - valid",
			serviceAccount: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title:  serviceaccounts.ExtSvcPrefix + "test-plugin",
					Role:   iamv0alpha1.ServiceAccountOrgRoleNone,
					Plugin: "test-plugin",
				},
			},
			requester: &identity.StaticRequester{
				Type:    types.TypeAccessPolicy,
				OrgRole: identity.RoleAdmin,
			},
			expectError: false,
		},
		{
			name: "external service account - invalid title prefix",
			serviceAccount: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title:  "invalid-prefix-test",
					Role:   iamv0alpha1.ServiceAccountOrgRoleNone,
					Plugin: "test",
				},
			},
			requester: &identity.StaticRequester{
				Type:    types.TypeAccessPolicy,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "title of external service accounts must start with " + serviceaccounts.ExtSvcPrefix,
		},
		{
			name: "external service account - invalid title suffix",
			serviceAccount: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title:  serviceaccounts.ExtSvcPrefix + "wrong-suffix",
					Role:   iamv0alpha1.ServiceAccountOrgRoleNone,
					Plugin: "test",
				},
			},
			requester: &identity.StaticRequester{
				Type:    types.TypeAccessPolicy,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "title of external service accounts must end with test",
		},
		{
			name: "external service account - non-access-policy requester",
			serviceAccount: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title:  serviceaccounts.ExtSvcPrefix + "test-test",
					Role:   iamv0alpha1.ServiceAccountOrgRoleNone,
					Plugin: "test",
				},
			},
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "only service identities can create external service accounts",
		},
		{
			name: "external service account - role not None",
			serviceAccount: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title:  serviceaccounts.ExtSvcPrefix + "test-test",
					Role:   iamv0alpha1.ServiceAccountOrgRoleViewer,
					Plugin: "test",
				},
			},
			requester: &identity.StaticRequester{
				Type:    types.TypeAccessPolicy,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "external service accounts must have role None",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := identity.WithRequester(
				context.Background(),
				tt.requester,
			)

			err := ValidateOnCreate(ctx, tt.serviceAccount)

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

func TestValidateOnCreate_NoRequester(t *testing.T) {
	serviceAccount := &iamv0alpha1.ServiceAccount{
		Spec: iamv0alpha1.ServiceAccountSpec{
			Title: "Test Service Account",
			Role:  iamv0alpha1.ServiceAccountOrgRoleViewer,
		},
	}

	err := ValidateOnCreate(context.Background(), serviceAccount)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no identity found")
}
