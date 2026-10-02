package serviceaccount

import (
	"context"
	"strings"
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
			name: "protected external service account title without plugin",
			serviceAccount: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title: strings.TrimSuffix(serviceaccounts.ExtSvcPrefix, "-") + "test",
					Role:  iamv0alpha1.ServiceAccountOrgRoleViewer,
				},
			},
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "protected prefix",
		},
		{
			name: "case variant of protected external service account title without plugin",
			serviceAccount: &iamv0alpha1.ServiceAccount{
				Spec: iamv0alpha1.ServiceAccountSpec{
					Title: "ExtSvc-test",
					Role:  iamv0alpha1.ServiceAccountOrgRoleViewer,
				},
			},
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "protected prefix",
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

func TestValidateOnUpdate(t *testing.T) {
	sa := func(title string, role iamv0alpha1.ServiceAccountOrgRole, plugin string) *iamv0alpha1.ServiceAccount {
		return &iamv0alpha1.ServiceAccount{
			Spec: iamv0alpha1.ServiceAccountSpec{
				Title:  title,
				Role:   role,
				Plugin: plugin,
			},
		}
	}

	tests := []struct {
		name          string
		old           *iamv0alpha1.ServiceAccount
		updated       *iamv0alpha1.ServiceAccount
		requester     *identity.StaticRequester
		expectError   bool
		errorContains string
	}{
		{
			name:    "valid update of title and role",
			old:     sa("Test Service Account", iamv0alpha1.ServiceAccountOrgRoleViewer, ""),
			updated: sa("Renamed Service Account", iamv0alpha1.ServiceAccountOrgRoleEditor, ""),
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError: false,
		},
		{
			name:    "empty title",
			old:     sa("Test Service Account", iamv0alpha1.ServiceAccountOrgRoleViewer, ""),
			updated: sa("", iamv0alpha1.ServiceAccountOrgRoleViewer, ""),
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "service account must have a title",
		},
		{
			name:    "invalid role",
			old:     sa("Test Service Account", iamv0alpha1.ServiceAccountOrgRoleViewer, ""),
			updated: sa("Test Service Account", "InvalidRole", ""),
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "invalid role",
		},
		{
			name:    "normal service account cannot acquire protected external title",
			old:     sa("Test Service Account", iamv0alpha1.ServiceAccountOrgRoleViewer, ""),
			updated: sa(strings.TrimSuffix(serviceaccounts.ExtSvcPrefix, "-")+"test", iamv0alpha1.ServiceAccountOrgRoleViewer, ""),
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "protected prefix",
		},
		{
			name:    "normal service account cannot acquire a case variant of protected external title",
			old:     sa("Test Service Account", iamv0alpha1.ServiceAccountOrgRoleViewer, ""),
			updated: sa("ExtSvc-test", iamv0alpha1.ServiceAccountOrgRoleViewer, ""),
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "protected prefix",
		},
		{
			name:    "role higher than requester's role",
			old:     sa("Test Service Account", iamv0alpha1.ServiceAccountOrgRoleViewer, ""),
			updated: sa("Test Service Account", iamv0alpha1.ServiceAccountOrgRoleAdmin, ""),
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleEditor,
			},
			expectError:   true,
			errorContains: "cannot assign a role higher than user's role",
		},
		{
			name:    "unchanged role higher than requester's role is allowed",
			old:     sa("Test Service Account", iamv0alpha1.ServiceAccountOrgRoleAdmin, ""),
			updated: sa("Renamed Service Account", iamv0alpha1.ServiceAccountOrgRoleAdmin, ""),
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleEditor,
			},
			expectError: false,
		},
		{
			name:    "plugin cannot be added",
			old:     sa("Test Service Account", iamv0alpha1.ServiceAccountOrgRoleViewer, ""),
			updated: sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleNone, "test"),
			requester: &identity.StaticRequester{
				Type:    types.TypeAccessPolicy,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "plugin of a service account cannot be changed",
		},
		{
			name:    "plugin cannot be removed",
			old:     sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleNone, "test"),
			updated: sa("Test Service Account", iamv0alpha1.ServiceAccountOrgRoleViewer, ""),
			requester: &identity.StaticRequester{
				Type:    types.TypeAccessPolicy,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "plugin of a service account cannot be changed",
		},
		{
			name:    "external service account updated by service identity",
			old:     sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleNone, "test"),
			updated: sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleNone, "test"),
			requester: &identity.StaticRequester{
				Type:    types.TypeAccessPolicy,
				OrgRole: identity.RoleAdmin,
			},
			expectError: false,
		},
		{
			name:    "external service account with legacy-derived empty plugin updated by service identity",
			old:     sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleNone, ""),
			updated: sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleNone, ""),
			requester: &identity.StaticRequester{
				Type:    types.TypeAccessPolicy,
				OrgRole: identity.RoleAdmin,
			},
			expectError: false,
		},
		{
			name:    "external service account title cannot change its prefix",
			old:     sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleNone, "test"),
			updated: sa("invalid-prefix-test", iamv0alpha1.ServiceAccountOrgRoleNone, "test"),
			requester: &identity.StaticRequester{
				Type:    types.TypeAccessPolicy,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "title of an external service account cannot be changed",
		},
		{
			name:    "external service account title cannot change while retaining its plugin suffix",
			old:     sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleNone, "test"),
			updated: sa(serviceaccounts.ExtSvcPrefix+"wrong-suffix", iamv0alpha1.ServiceAccountOrgRoleNone, "test"),
			requester: &identity.StaticRequester{
				Type:    types.TypeAccessPolicy,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "title of an external service account cannot be changed",
		},
		{
			name:    "external service account - non-access-policy requester",
			old:     sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleNone, "test"),
			updated: sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleNone, "test"),
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			expectError:   true,
			errorContains: "only service identities can update external service accounts",
		},
		{
			name:    "external service account - role not None",
			old:     sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleNone, "test"),
			updated: sa(serviceaccounts.ExtSvcPrefix+"test", iamv0alpha1.ServiceAccountOrgRoleViewer, "test"),
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

			err := ValidateOnUpdate(ctx, tt.updated, tt.old)

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

func TestValidateOnUpdate_NoRequester(t *testing.T) {
	serviceAccount := &iamv0alpha1.ServiceAccount{
		Spec: iamv0alpha1.ServiceAccountSpec{
			Title: "Test Service Account",
			Role:  iamv0alpha1.ServiceAccountOrgRoleViewer,
		},
	}

	err := ValidateOnUpdate(context.Background(), serviceAccount, serviceAccount)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no identity found")
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
