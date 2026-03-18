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
			name: "changing manager identity is blocked",
			auth: provisioner,
			err:  "Cannot change resource manager",
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "xyz",
					},
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
		{
			name: "changing manager kind is blocked",
			auth: provisioner,
			err:  "Cannot change resource manager",
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindKubectl),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
		{
			name: "changing manager kind and identity is blocked",
			auth: provisioner,
			err:  "Cannot change resource manager",
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "def",
					},
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
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

func TestEnsureSameRepoManager(t *testing.T) {
	tests := []struct {
		name            string
		folderManager   *utils.ManagerProperties
		resourceManager *utils.ManagerProperties
		expectError     bool
	}{
		{
			name:            "unmanaged folder, unmanaged resource",
			folderManager:   nil,
			resourceManager: nil,
			expectError:     false,
		},
		{
			name:          "unmanaged folder, resource managed by repo",
			folderManager: nil,
			resourceManager: &utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-1",
			},
			expectError: false,
		},
		{
			name: "folder and resource managed by same repo",
			folderManager: &utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-1",
			},
			resourceManager: &utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-1",
			},
			expectError: false,
		},
		{
			name: "folder managed by repo, resource unmanaged",
			folderManager: &utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-1",
			},
			resourceManager: nil,
			expectError:     true,
		},
		{
			name: "folder and resource managed by different repos",
			folderManager: &utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-1",
			},
			resourceManager: &utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-2",
			},
			expectError: true,
		},
		{
			name: "folder managed by repo, resource managed by plugin",
			folderManager: &utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-1",
			},
			resourceManager: &utils.ManagerProperties{
				Kind:     utils.ManagerKindPlugin,
				Identity: "plugin-1",
			},
			expectError: true,
		},
		{
			name: "folder managed by terraform — skipped (non-repo)",
			folderManager: &utils.ManagerProperties{
				Kind:     utils.ManagerKindTerraform,
				Identity: "tf-1",
			},
			resourceManager: nil,
			expectError:     false,
		},
		{
			name: "folder managed by kubectl — skipped (non-repo)",
			folderManager: &utils.ManagerProperties{
				Kind:     utils.ManagerKindKubectl,
				Identity: "k-1",
			},
			resourceManager: &utils.ManagerProperties{
				Kind:     utils.ManagerKindKubectl,
				Identity: "k-2",
			},
			expectError: false,
		},
	}

	makeAccessor := func(t *testing.T, mgr *utils.ManagerProperties) utils.GrafanaMetaAccessor {
		t.Helper()
		obj := &dashboard.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "test", Namespace: "default"}}
		accessor, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		if mgr != nil {
			accessor.SetManagerProperties(*mgr)
		}
		return accessor
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			folder := makeAccessor(t, tt.folderManager)
			resource := makeAccessor(t, tt.resourceManager)

			err := ensureSameRepoManager(folder, resource)
			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
