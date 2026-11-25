package identity_test

import (
	"context"
	"errors"
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
		orgAdmin:    &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "org-admin", OrgRole: authtypes.RoleAdmin},
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

var errMayNotAssign = errors.New("may not assign")

type testManagerKind struct {
	kind      utils.ManagerKind
	mayAssign func(authtypes.AuthInfo) bool
}

func (k testManagerKind) Kind() utils.ManagerKind {
	return k.kind
}

func (k testManagerKind) CheckAssignment(auth authtypes.AuthInfo, _ utils.GrafanaMetaAccessor) error {
	if k.mayAssign(auth) {
		return nil
	}
	return errMayNotAssign
}

const (
	kindAssignedByProvisioner utils.ManagerKind = "test-assigned-by-provisioner"
	kindAssignedByNobody      utils.ManagerKind = "test-assigned-by-nobody"
)

// A registration lasts for the whole test binary and a second one panics, so the
// tests share these instead of registering their own.
func init() {
	identity.RegisterManagerKind(testManagerKind{
		kind:      kindAssignedByProvisioner,
		mayAssign: identity.IsProvisioningServiceIdentity,
	})
	identity.RegisterManagerKind(testManagerKind{
		kind:      kindAssignedByNobody,
		mayAssign: func(authtypes.AuthInfo) bool { return false },
	})
}

func TestRegisteredManagerKind(t *testing.T) {
	who := identities(t)
	anyone := func(authtypes.AuthInfo) bool { return true }
	repo := managedBy(t, utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "my-repo"})

	t.Run("its check decides who may assign it", func(t *testing.T) {
		withIdentity := func() utils.GrafanaMetaAccessor {
			return managedBy(t, utils.ManagerProperties{Kind: kindAssignedByProvisioner, Identity: "the-manager"})
		}
		withoutIdentity := func() utils.GrafanaMetaAccessor {
			return managedBy(t, utils.ManagerProperties{Kind: kindAssignedByProvisioner})
		}

		require.ErrorIs(t, identity.CheckManagerOnCreate(who.user, withIdentity()), errMayNotAssign, "create")
		require.ErrorIs(t, identity.CheckManagerOnCreate(who.user, withoutIdentity()), errMayNotAssign, "create without a manager identity")
		require.NoError(t, identity.CheckManagerOnCreate(who.provisioner, withIdentity()), "create")

		require.ErrorIs(t, identity.CheckManagerOnUpdate(who.user, withIdentity(), unmanaged(t)), errMayNotAssign, "adopt")
		require.NoError(t, identity.CheckManagerOnUpdate(who.provisioner, withIdentity(), unmanaged(t)), "adopt")
		require.True(t, apierrors.IsForbidden(identity.CheckManagerOnUpdate(who.provisioner, withIdentity(), repo)),
			"the kind may not change from another manager")

		require.NoError(t, identity.CheckManagerOnUpdate(who.user, withIdentity(), withIdentity()), "update")
		require.True(t, apierrors.IsForbidden(identity.CheckManagerOnUpdate(who.provisioner,
			managedBy(t, utils.ManagerProperties{Kind: kindAssignedByProvisioner, Identity: "another-manager"}), withIdentity())),
			"the identity may not change")

		require.NoError(t, identity.CheckManagerOnUpdate(who.user, unmanaged(t), withIdentity()), "release")
		require.NoError(t, identity.CheckManagerOnUpdate(who.user, withoutIdentity(), withIdentity()), "dropping the identity releases it")
		require.NoError(t, identity.CheckManagerOnDelete(who.user, withIdentity()), "delete")
	})

	t.Run("an update adding it without an identity leaves the resource unmanaged, as for the built-in kinds", func(t *testing.T) {
		obj := managedBy(t, utils.ManagerProperties{Kind: kindAssignedByProvisioner})
		_, managed := obj.GetManagerProperties()
		require.False(t, managed)
		require.NoError(t, identity.CheckManagerOnUpdate(who.user, obj, unmanaged(t)))
	})

	t.Run("each kind has its own check, which leaves other kinds alone", func(t *testing.T) {
		require.ErrorIs(t, identity.CheckManagerOnCreate(who.provisioner,
			managedBy(t, utils.ManagerProperties{Kind: kindAssignedByNobody, Identity: "the-manager"})), errMayNotAssign)
		require.NoError(t, identity.CheckManagerOnCreate(who.provisioner, repo))
		require.NoError(t, identity.CheckManagerOnCreate(who.user, unmanaged(t)))
	})

	t.Run("a kind nobody registered is not managed", func(t *testing.T) {
		obj := managedBy(t, utils.ManagerProperties{Kind: "test-never-registered", Identity: "the-manager"})
		require.NoError(t, identity.CheckManagerOnCreate(who.user, obj))
	})

	t.Run("a second registration panics and keeps the first", func(t *testing.T) {
		require.Panics(t, func() {
			identity.RegisterManagerKind(testManagerKind{
				kind:      kindAssignedByProvisioner,
				mayAssign: anyone,
			})
		})
		obj := managedBy(t, utils.ManagerProperties{Kind: kindAssignedByProvisioner, Identity: "the-manager"})
		require.ErrorIs(t, identity.CheckManagerOnCreate(who.user, obj), errMayNotAssign)
	})

	t.Run("built-in kinds are refused", func(t *testing.T) {
		require.Panics(t, func() {
			identity.RegisterManagerKind(testManagerKind{
				kind:      utils.ManagerKindRepo,
				mayAssign: anyone,
			})
		})
		require.ErrorIs(t, identity.CheckManagerOnCreate(who.user, repo), identity.ErrResourceIsManagedInRepository)
	})
}
