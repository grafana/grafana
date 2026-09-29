package apistore

import (
	"context"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	authnlib "github.com/grafana/authlib/authn"
	authtypes "github.com/grafana/authlib/types"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	serviceauthn "github.com/grafana/grafana/pkg/services/authn"
)

func TestManagedAuthorizer(t *testing.T) {
	user := &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "uuu"}
	_, provisioner, err := identity.WithProvisioningIdentity(context.Background(), "default")
	require.NoError(t, err)

	tests := []struct {
		name string
		auth authtypes.AuthInfo
		obj  runtime.Object
		old  runtime.Object
		err  string
	}{
		{
			name: "user can create",
			auth: user,
			obj:  &unstructured.Unstructured{},
		},
		{
			name: "provisioning can create",
			auth: provisioner,
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
		{
			name: "user can not create provisioned resource",
			auth: user,
			err:  "Provisioned resources must be manaaged by the provisioning service account",
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
		{
			name: "user can not update provisioned resource",
			auth: user,
			err:  "Provisioned resources must be manaaged by the provisioning service account",
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
		{
			name: "provisioner can remove manager flags",
			auth: provisioner,
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
		{
			name: "provisioner can add manager flags",
			auth: provisioner,
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
				},
			},
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
		{
			name: "audience includes provisioning group",
			auth: &serviceauthn.Identity{
				Type: authtypes.TypeAccessPolicy,
				UID:  "access-policy:random-uid",
				AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
					Claims: jwt.Claims{
						Audience: []string{provisioning.GROUP},
					},
				},
			},
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind: string(utils.ManagerKindRepo),
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj, err := utils.MetaAccessor(tt.obj)
			require.NoError(t, err)

			if tt.old == nil {
				err = checkManagerPropertiesOnCreate(tt.auth, obj)
			} else {
				old, _ := utils.MetaAccessor(tt.old)
				err = checkManagerPropertiesOnUpdateSpec(tt.auth, obj, old)
			}

			if tt.err != "" {
				require.Error(t, err, tt.err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

// TestClassicFileProvisioningAssignment covers the gate on assigning classic-file-provisioning
// provenance. It fires only where the provenance is acquired, so delete, rewrite-in-place
// (allowUiUpdates) and annotation removal must all keep working.
func TestClassicFileProvisioningAssignment(t *testing.T) {
	user := &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "uuu"}
	_, serviceIdentity := identity.WithServiceIdentity(context.Background(), 1)

	classicFP := func(mutate ...func(map[string]string)) *dashboard.Dashboard {
		annotations := map[string]string{
			utils.AnnoKeyManagerKind:     string(utils.ManagerKindClassicFP), // nolint:staticcheck
			utils.AnnoKeyManagerIdentity: "default",
			utils.AnnoKeySourcePath:      "/etc/grafana/provisioning/dashboards/x.json",
		}
		for _, m := range mutate {
			m(annotations)
		}
		return &dashboard.Dashboard{ObjectMeta: v1.ObjectMeta{Annotations: annotations}}
	}
	unmanaged := func() *dashboard.Dashboard { return &dashboard.Dashboard{} }

	const forbidden = "Can not set the classic-file-provisioning resource manager"

	tests := []struct {
		name string
		auth authtypes.AuthInfo
		obj  runtime.Object
		old  runtime.Object // nil => exercise the create path
		err  string
	}{
		{
			// The vulnerability.
			name: "user can not forge classic-file-provisioning on create",
			auth: user,
			obj:  classicFP(),
			err:  forbidden,
		},
		{
			name: "file provisioner can create classic-file-provisioning resource",
			auth: serviceIdentity,
			obj:  classicFP(),
		},
		{
			name: "user can still create an unmanaged resource",
			auth: user,
			obj:  unmanaged(),
		},
		{
			// Same forgery, via update.
			name: "user can not add classic-file-provisioning to an unmanaged resource",
			auth: user,
			obj:  classicFP(),
			old:  unmanaged(),
			err:  forbidden,
		},
		{
			name: "file provisioner can add classic-file-provisioning to an unmanaged resource",
			auth: serviceIdentity,
			obj:  classicFP(),
			old:  unmanaged(),
		},
		{
			name: "user can update a resource that already carries the manager",
			auth: user,
			obj:  classicFP(func(a map[string]string) { a[utils.AnnoKeySourcePath] = "/etc/grafana/provisioning/dashboards/y.json" }),
			old:  classicFP(),
		},
		{
			name: "user can update a resource the manager allows edits on",
			auth: user,
			obj:  classicFP(func(a map[string]string) { a[utils.AnnoKeyManagerAllowsEdits] = "true" }),
			old:  classicFP(func(a map[string]string) { a[utils.AnnoKeyManagerAllowsEdits] = "true" }),
		},
		{
			// Recovery path for anything forged before the gate shipped.
			name: "user can remove the classic-file-provisioning manager",
			auth: user,
			obj:  unmanaged(),
			old:  classicFP(),
		},
		{
			// Scoped to classic-FP: plugin provenance is set by /api/dashboards/import as
			// the signed-in user, so gating it would break plugin dashboard import.
			name: "user can still set plugin provenance",
			auth: user,
			obj: &dashboard.Dashboard{ObjectMeta: v1.ObjectMeta{Annotations: map[string]string{
				utils.AnnoKeyManagerKind:     string(utils.ManagerKindPlugin),
				utils.AnnoKeyManagerIdentity: "grafana-clock-panel",
			}}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj, err := utils.MetaAccessor(tt.obj)
			require.NoError(t, err)

			if tt.old == nil {
				err = checkManagerPropertiesOnCreate(tt.auth, obj)
			} else {
				old, oldErr := utils.MetaAccessor(tt.old)
				require.NoError(t, oldErr)
				err = checkManagerPropertiesOnUpdateSpec(tt.auth, obj, old)
			}

			if tt.err == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			require.Contains(t, err.Error(), tt.err)
		})
	}

	// Delete is unchanged: gating here would break admin deletes of genuinely provisioned
	// resources, which are protected above storage.
	t.Run("delete of a classic-file-provisioning resource is unchanged", func(t *testing.T) {
		obj, err := utils.MetaAccessor(classicFP())
		require.NoError(t, err)
		require.NoError(t, checkManagerPropertiesOnDelete(user, obj))
	})
}
