package apistore

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	clientrest "k8s.io/client-go/rest"

	authnlib "github.com/grafana/authlib/authn"
	authtypes "github.com/grafana/authlib/types"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	serviceauthn "github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestManagedAuthorizer(t *testing.T) {
	user := &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "uuu"}
	serverAdmin := &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "server-admin-uuu", IsGrafanaAdmin: true}
	orgAdmin := &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "org-admin-uuu", OrgRole: identity.RoleAdmin}
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
			err:  "this resource is managed by a repository",
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
			err:  "Can not remove resource manager from resource",
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
		{
			name: "server admin can release repo-managed dashboard",
			auth: serverAdmin,
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
						utils.AnnoKeyManagerIdentity: "my-repo",
					},
				},
			},
		},
		{
			name: "server admin can release repo-managed folder",
			auth: serverAdmin,
			obj: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"generation": int64(1),
					},
				},
			},
			old: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"generation": int64(2),
						"annotations": map[string]interface{}{
							utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
							utils.AnnoKeyManagerIdentity: "my-repo",
						},
					},
				},
			},
		},
		{
			name: "org admin can release repo-managed dashboard",
			auth: orgAdmin,
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
						utils.AnnoKeyManagerIdentity: "my-repo",
					},
				},
			},
		},
		{
			name: "non-admin user cannot release repo-managed resource",
			auth: user,
			err:  "Can not remove resource manager from resource",
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
						utils.AnnoKeyManagerIdentity: "my-repo",
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
				require.ErrorContains(t, err, tt.err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestManagedResourceCommitMessage(t *testing.T) {
	tests := []struct {
		name        string
		objectName  string
		annotations map[string]string
		action      resourcepb.WatchEvent_Type
		want        string
	}{
		{
			name:       "uses grafana.app/message annotation when set (MODIFIED)",
			objectName: "dash-uid",
			annotations: map[string]string{
				utils.AnnoKeyMessage: "Custom commit message",
			},
			action: resourcepb.WatchEvent_MODIFIED,
			want:   "Custom commit message",
		},
		{
			name:       "annotation wins over action-specific fallback (DELETED)",
			objectName: "dash-uid",
			annotations: map[string]string{
				utils.AnnoKeyMessage: "Custom delete message",
			},
			action: resourcepb.WatchEvent_DELETED,
			want:   "Custom delete message",
		},
		{
			name:        "MODIFIED falls back to 'Update <name>' when annotation is absent",
			objectName:  "dash-uid",
			annotations: nil,
			action:      resourcepb.WatchEvent_MODIFIED,
			want:        "Update dash-uid",
		},
		{
			name:        "ADDED falls back to 'Create <name>' when annotation is absent",
			objectName:  "dash-uid",
			annotations: nil,
			action:      resourcepb.WatchEvent_ADDED,
			want:        "Create dash-uid",
		},
		{
			name:        "DELETED falls back to 'Delete <name>' when annotation is absent",
			objectName:  "dash-uid",
			annotations: nil,
			action:      resourcepb.WatchEvent_DELETED,
			want:        "Delete dash-uid",
		},
		{
			name:       "MODIFIED falls back to 'Update <name>' when annotation is an empty string",
			objectName: "dash-uid",
			annotations: map[string]string{
				utils.AnnoKeyMessage: "",
			},
			action: resourcepb.WatchEvent_MODIFIED,
			want:   "Update dash-uid",
		},
		{
			name:       "preserves whitespace-only annotation verbatim",
			objectName: "dash-uid",
			annotations: map[string]string{
				utils.AnnoKeyMessage: "   ",
			},
			action: resourcepb.WatchEvent_MODIFIED,
			want:   "   ",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Name:        tt.objectName,
					Annotations: tt.annotations,
				},
			}
			accessor, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			require.Equal(t, tt.want, managedResourceCommitMessage(accessor, tt.action))
		})
	}
}

// fakeRestConfigProvider returns a rest.Config pointing at an arbitrary host,
// used so tests can capture proxied REST requests with an httptest.Server.
type fakeRestConfigProvider struct {
	host string
}

func (f *fakeRestConfigProvider) GetRestConfig(_ context.Context) (*clientrest.Config, error) {
	return &clientrest.Config{Host: f.host}, nil
}

func TestHandleManagedResourceRouting_ForwardsCommitMessage(t *testing.T) {
	tests := []struct {
		name        string
		action      resourcepb.WatchEvent_Type
		annotations map[string]string
		wantMethod  string
		wantMessage string
	}{
		{
			name:   "MODIFIED uses grafana.app/message annotation",
			action: resourcepb.WatchEvent_MODIFIED,
			annotations: map[string]string{
				utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
				utils.AnnoKeyManagerIdentity: "my-repo",
				utils.AnnoKeySourcePath:      "dashboards/dash.json",
				utils.AnnoKeyMessage:         "Custom commit message",
			},
			wantMethod:  http.MethodPut,
			wantMessage: "Custom commit message",
		},
		{
			name:   "MODIFIED falls back to 'Update <name>' when annotation is absent",
			action: resourcepb.WatchEvent_MODIFIED,
			annotations: map[string]string{
				utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
				utils.AnnoKeyManagerIdentity: "my-repo",
				utils.AnnoKeySourcePath:      "dashboards/dash.json",
			},
			wantMethod:  http.MethodPut,
			wantMessage: "Update dash-uid",
		},
		{
			name:   "ADDED also forwards the commit message",
			action: resourcepb.WatchEvent_ADDED,
			annotations: map[string]string{
				utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
				utils.AnnoKeyManagerIdentity: "my-repo",
				utils.AnnoKeySourcePath:      "dashboards/dash.json",
				utils.AnnoKeyMessage:         "Create dash.json",
			},
			wantMethod:  http.MethodPost,
			wantMessage: "Create dash.json",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var captured struct {
				method string
				path   string
				query  url.Values
			}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				captured.method = r.Method
				captured.path = r.URL.Path
				captured.query = r.URL.Query()
				// Return a 5xx so the caller short-circuits before reaching
				// the post-write s.Get call (which would need a full store).
				http.Error(w, "intentional test failure", http.StatusInternalServerError)
			}))
			t.Cleanup(server.Close)

			s := &Storage{configProvider: &fakeRestConfigProvider{host: server.URL}}
			obj := &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Name:        "dash-uid",
					Namespace:   "default",
					Annotations: tt.annotations,
				},
			}

			err := s.handleManagedResourceRouting(
				context.Background(),
				errResourceIsManagedInRepository,
				tt.action,
				"/default/dashboards/dash-uid",
				obj,
				&dashboard.Dashboard{},
			)
			// The test server returns 500; surface that as a non-nil error.
			require.Error(t, err)

			require.Equal(t, tt.wantMethod, captured.method, "HTTP method")
			require.Contains(t, captured.path, "/namespaces/default/repositories/my-repo/files/dashboards/dash.json",
				"request path should target the provisioning files endpoint")
			require.Equal(t, tt.wantMessage, captured.query.Get("message"), "message query parameter")
			require.Equal(t, "true", captured.query.Get("skipDryRun"), "skipDryRun query parameter should be forwarded")
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
