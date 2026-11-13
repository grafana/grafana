package identity_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	authtypes "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func managedBy(t *testing.T, manager utils.ManagerProperties) utils.GrafanaMetaAccessor {
	t.Helper()
	meta, err := utils.MetaAccessor(&unstructured.Unstructured{Object: map[string]any{}})
	require.NoError(t, err)
	meta.SetManagerProperties(manager)
	return meta
}

func unmanaged(t *testing.T) utils.GrafanaMetaAccessor {
	t.Helper()
	meta, err := utils.MetaAccessor(&unstructured.Unstructured{Object: map[string]any{}})
	require.NoError(t, err)
	return meta
}

type callers struct {
	user, service, provisioner, orgAdmin, serverAdmin authtypes.AuthInfo
}

func identities(t *testing.T) callers {
	t.Helper()
	_, provisioner, err := identity.WithProvisioningIdentity(context.Background(), "default")
	require.NoError(t, err)
	return callers{
		user:        &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "uuu"},
		service:     &identity.StaticRequester{Type: authtypes.TypeAccessPolicy, UserUID: "service"},
		provisioner: provisioner,
		orgAdmin:    &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "org-admin", OrgRole: identity.RoleAdmin},
		serverAdmin: &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "server-admin", IsGrafanaAdmin: true},
	}
}

func TestCheckWriteAuthz(t *testing.T) {
	who := identities(t)

	tests := []struct {
		name    string
		auth    authtypes.AuthInfo
		manager utils.ManagerProperties
		wantErr error
	}{
		{
			name:    "a who.user may not write a repo-managed resource",
			auth:    who.user,
			manager: utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "my-repo"},
			wantErr: identity.ErrResourceIsManagedInRepository,
		},
		{
			name:    "the provisioning service may",
			auth:    who.provisioner,
			manager: utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "my-repo"},
		},
		{
			name:    "a plain service identity is not the provisioning service",
			auth:    who.service,
			manager: utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "my-repo"},
			wantErr: identity.ErrResourceIsManagedInRepository,
		},
		{
			name:    "classic file provisioning is not gated",
			auth:    who.user,
			manager: utils.ManagerProperties{Kind: utils.ManagerKindClassicFP}, //nolint:staticcheck
		},
		{
			name:    "plugin-managed is not gated",
			auth:    who.user,
			manager: utils.ManagerProperties{Kind: utils.ManagerKindPlugin, Identity: "some-plugin"},
		},
		{
			name:    "terraform without allowEdits is still not gated today",
			auth:    who.user,
			manager: utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "terraform-provider"},
		},
		{
			name:    "unmanaged",
			auth:    who.user,
			manager: utils.ManagerProperties{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := identity.CheckManagerWriteAuthz(tt.auth, managedBy(t, tt.manager))
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestCheckClassicFPAssignment(t *testing.T) {
	who := identities(t)
	classicFP := utils.ManagerProperties{Kind: utils.ManagerKindClassicFP} //nolint:staticcheck

	t.Run("only the file who.provisioner may assign it", func(t *testing.T) {
		require.True(t, apierrors.IsForbidden(identity.CheckClassicFPAssignment(who.user, managedBy(t, classicFP))))
		require.NoError(t, identity.CheckClassicFPAssignment(who.service, managedBy(t, classicFP)))
	})

	t.Run("other kinds are not its business", func(t *testing.T) {
		require.NoError(t, identity.CheckClassicFPAssignment(who.user,
			managedBy(t, utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "my-repo"})))
	})
}

func TestCheckOnUpdate(t *testing.T) {
	who := identities(t)
	repo := utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "my-repo"}

	tests := []struct {
		name      string
		auth      authtypes.AuthInfo
		old       utils.GrafanaMetaAccessor
		proposed  utils.GrafanaMetaAccessor
		forbidden bool
	}{
		{
			name:     "neither side managed",
			auth:     who.user,
			old:      unmanaged(t),
			proposed: unmanaged(t),
		},
		{
			name:     "the who.provisioner rewriting its own resource",
			auth:     who.provisioner,
			old:      managedBy(t, repo),
			proposed: managedBy(t, repo),
		},
		{
			name:      "a who.user editing a repo-managed resource",
			auth:      who.user,
			old:       managedBy(t, repo),
			proposed:  managedBy(t, repo),
			forbidden: true,
		},
		{
			name:      "a who.user may not release it either",
			auth:      who.user,
			old:       managedBy(t, repo),
			proposed:  unmanaged(t),
			forbidden: true,
		},
		{
			name:     "an org admin may release it",
			auth:     who.orgAdmin,
			old:      managedBy(t, repo),
			proposed: unmanaged(t),
		},
		{
			name:     "a server admin may release it",
			auth:     who.serverAdmin,
			old:      managedBy(t, repo),
			proposed: unmanaged(t),
		},
		{
			name:      "the kind may not change",
			auth:      who.provisioner,
			old:       managedBy(t, repo),
			proposed:  managedBy(t, utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "my-repo"}),
			forbidden: true,
		},
		{
			name:     "adopting an unmanaged resource",
			auth:     who.provisioner,
			old:      unmanaged(t),
			proposed: managedBy(t, repo),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := identity.CheckManagerOnUpdate(tt.auth, tt.proposed, tt.old)
			if tt.forbidden {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestCheckOnCreateAndDelete(t *testing.T) {
	who := identities(t)
	repo := managedBy(t, utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "my-repo"})

	require.ErrorIs(t, identity.CheckManagerOnCreate(who.user, repo), identity.ErrResourceIsManagedInRepository)
	require.ErrorIs(t, identity.CheckManagerOnDelete(who.user, repo), identity.ErrResourceIsManagedInRepository)
	require.NoError(t, identity.CheckManagerOnCreate(who.provisioner, repo))
	require.NoError(t, identity.CheckManagerOnDelete(who.provisioner, repo))

	// Create additionally gates the classic-file-provisioning assignment.
	classicFP := managedBy(t, utils.ManagerProperties{Kind: utils.ManagerKindClassicFP}) //nolint:staticcheck
	require.True(t, apierrors.IsForbidden(identity.CheckManagerOnCreate(who.user, classicFP)))
	require.NoError(t, identity.CheckManagerOnDelete(who.user, classicFP))
}
