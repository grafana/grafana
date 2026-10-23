package apistore

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	clientrest "k8s.io/client-go/rest"

	authtypes "github.com/grafana/authlib/types"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestManagedAuthorizer_ManagerKindConflict(t *testing.T) {
	_, provisioner, err := identity.WithProvisioningIdentity(t.Context(), "default")
	require.NoError(t, err)
	for _, current := range []utils.ManagerProperties{
		{Kind: utils.ManagerKindTerraform, Identity: "terraform-provider", AllowsEdits: true},
		{Kind: utils.ManagerKindClassicFP}, //nolint:staticcheck
	} {
		t.Run(string(current.Kind), func(t *testing.T) {
			old, err := utils.MetaAccessor(&unstructured.Unstructured{})
			require.NoError(t, err)
			old.SetManagerProperties(current)
			obj, err := utils.MetaAccessor(&unstructured.Unstructured{})
			require.NoError(t, err)
			obj.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "dashboards"})

			err = checkManagerPropertiesOnUpdateSpec(provisioner, obj, old)
			require.Error(t, err)
			require.True(t, apierrors.IsForbidden(err))
			require.True(t, utils.IsForbiddenManagerKindChangeError(err))
			require.True(t, apierrors.HasStatusCause(err, "ResourceManagerKindConflict"))
			require.Contains(t, err.Error(), string(current.Kind))
			require.Contains(t, err.Error(), `to "repo" (identity "dashboards")`)
		})
	}
}

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
			// Classic kinds have an unstable or absent identity (a file-provisioning
			// reader name, or empty for API/converted-Prometheus), so identity changes
			// within the same classic kind are allowed rather than blocked.
			name: "classic file-provisioning: identity change is allowed",
			auth: provisioner,
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindClassicFP), //nolint:staticcheck
						utils.AnnoKeyManagerIdentity: "reader-b",
					},
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindClassicFP), //nolint:staticcheck
						utils.AnnoKeyManagerIdentity: "reader-a",
					},
				},
			},
		},
		{
			name: "classic converted-prometheus: identity change is allowed",
			auth: user,
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindClassicConvertedPrometheus), //nolint:staticcheck
						utils.AnnoKeyManagerIdentity: "b",
					},
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindClassicConvertedPrometheus), //nolint:staticcheck
						utils.AnnoKeyManagerIdentity: "a",
					},
				},
			},
		},
		{
			// The classic exemption must not open a bypass: switching an existing
			// non-classic manager to a classic kind is still a kind change and is
			// blocked by the kind guard before the identity check is reached.
			name: "changing a repo manager to a classic kind is blocked",
			auth: provisioner,
			err:  "Cannot change resource manager kind",
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindClassicFP), //nolint:staticcheck
						utils.AnnoKeyManagerIdentity: "reader-a",
					},
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "reader-a",
					},
				},
			},
		},
		{
			// Non-classic managers keep the identity-immutability guarantee.
			name: "kubectl: identity change is still blocked",
			auth: provisioner,
			err:  "Cannot change resource manager identity",
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindKubectl),
						utils.AnnoKeyManagerIdentity: "b",
					},
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindKubectl),
						utils.AnnoKeyManagerIdentity: "a",
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
			name: "terraform: legacy (User-Agent) → new (simple ID) allowed (migration)",
			auth: user,
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "grafana-terraform-provider",
					},
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "Terraform/crossTF000 (+https://www.terraform.io) terraform-provider-grafana/crossplane",
					},
				},
			},
		},
		{
			name: "terraform: new (simple ID) → new (different simple ID) blocked",
			auth: user,
			err:  "Cannot change Terraform manager ID; stable custom IDs are immutable",
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "my-terraform-provider-v2",
					},
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "my-terraform-provider",
					},
				},
			},
		},
		{
			name: "terraform: legacy (User-Agent) → legacy (different User-Agent) allowed",
			auth: user,
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "Terraform/1.6.0 (+https://www.terraform.io) terraform-provider-grafana/v4.0.0",
					},
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "Terraform/crossTF000 (+https://www.terraform.io) terraform-provider-grafana/crossplane",
					},
				},
			},
		},
		{
			name: "terraform: new (simple ID) → legacy (User-Agent) blocked (no reverting)",
			auth: user,
			err:  "Cannot change Terraform manager ID back to User-Agent format",
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "Terraform/1.5.0 (+https://www.terraform.io) terraform-provider-grafana/v3.0.0",
					},
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "grafana-terraform-provider",
					},
				},
			},
		},
		{
			name: "audience includes provisioning group",
			auth: &audienceAuthInfo{
				StaticRequester: &identity.StaticRequester{Type: authtypes.TypeAccessPolicy, UserUID: "random-uid"},
				audience:        []string{provisioning.GROUP},
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

// audienceAuthInfo reports an access token audience, which StaticRequester does not.
type audienceAuthInfo struct {
	*identity.StaticRequester
	audience []string
}

func (a *audienceAuthInfo) GetAudience() []string { return a.audience }

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

			cleanupSafe, err := s.handleManagedResourceRouting(
				context.Background(),
				errResourceIsManagedInRepository,
				tt.action,
				"/default/dashboards/dash-uid",
				obj,
				&dashboard.Dashboard{},
			)
			// The test server returns an error; surface that as a non-nil error.
			require.Error(t, err)
			// Once the request is sent the write may have applied, so cleanup is never safe.
			require.False(t, cleanupSafe, "a sent request must not report cleanupSafe")

			require.Equal(t, tt.wantMethod, captured.method, "HTTP method")
			require.Contains(t, captured.path, "/namespaces/default/repositories/my-repo/files/dashboards/dash.json",
				"request path should target the provisioning files endpoint")
			require.Equal(t, tt.wantMessage, captured.query.Get("message"), "message query parameter")
			require.Equal(t, "true", captured.query.Get("skipDryRun"), "skipDryRun query parameter should be forwarded")
		})
	}
}

func TestManagerNotFound(t *testing.T) {
	tests := []struct {
		name        string
		status      int
		annotations map[string]string
		want        bool
	}{
		{
			name:   "repository not found",
			status: http.StatusNotFound,
			annotations: map[string]string{
				utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
				utils.AnnoKeyManagerIdentity: "my-repo",
			},
			want: true,
		},
		{
			name:   "repository exists",
			status: http.StatusOK,
			annotations: map[string]string{
				utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
				utils.AnnoKeyManagerIdentity: "my-repo",
			},
			want: false,
		},
		{
			name:   "lookup fails with a server error",
			status: http.StatusInternalServerError,
			annotations: map[string]string{
				utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
				utils.AnnoKeyManagerIdentity: "my-repo",
			},
			want: false,
		},
		{
			name:        "resource is not managed",
			status:      http.StatusNotFound,
			annotations: nil,
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.status)
				_, _ = w.Write([]byte(`{"kind":"Status","apiVersion":"v1","status":"Failure","code":` + strconv.Itoa(tt.status) + `}`))
			}))
			t.Cleanup(server.Close)

			s := &Storage{configProvider: &fakeRestConfigProvider{host: server.URL}}
			obj := &dashboard.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "d", Namespace: "default", Annotations: tt.annotations}}
			accessor, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			_, err = s.getManager(context.Background(), accessor)
			require.Equal(t, tt.want, apierrors.IsNotFound(err))
		})
	}
}

func TestAllowOrphanedUpdate(t *testing.T) {
	notFound := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"kind":"Status","apiVersion":"v1","status":"Failure","code":404}`))
	}))
	t.Cleanup(notFound.Close)

	newObj := func(t *testing.T, mgr utils.ManagerProperties, src utils.SourceProperties) utils.GrafanaMetaAccessor {
		accessor, err := utils.MetaAccessor(&dashboard.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "d", Namespace: "default"}})
		require.NoError(t, err)
		accessor.SetManagerProperties(mgr)
		accessor.SetSourceProperties(src)
		return accessor
	}
	repoMgr := utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "my-repo"}
	s := &Storage{configProvider: &fakeRestConfigProvider{host: notFound.URL}}
	ctx := context.Background()

	t.Run("allows a write that changes nothing but metadata", func(t *testing.T) {
		old := newObj(t, repoMgr, utils.SourceProperties{})
		cur := newObj(t, repoMgr, utils.SourceProperties{})
		require.True(t, s.allowOrphanedUpdate(ctx, errResourceIsManagedInRepository, cur, old, false))
	})
	t.Run("rejects a write that changes the content", func(t *testing.T) {
		old := newObj(t, repoMgr, utils.SourceProperties{})
		cur := newObj(t, repoMgr, utils.SourceProperties{})
		require.False(t, s.allowOrphanedUpdate(ctx, errResourceIsManagedInRepository, cur, old, true))
	})
	t.Run("rejects a write that changes the manager", func(t *testing.T) {
		old := newObj(t, repoMgr, utils.SourceProperties{})
		cur := newObj(t, utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "other"}, utils.SourceProperties{})
		require.False(t, s.allowOrphanedUpdate(ctx, errResourceIsManagedInRepository, cur, old, false))
	})
	t.Run("rejects a write that changes the source path", func(t *testing.T) {
		old := newObj(t, repoMgr, utils.SourceProperties{Path: "a.json"})
		cur := newObj(t, repoMgr, utils.SourceProperties{Path: "b.json"})
		require.False(t, s.allowOrphanedUpdate(ctx, errResourceIsManagedInRepository, cur, old, false))
	})
	t.Run("ignores other errors", func(t *testing.T) {
		old := newObj(t, repoMgr, utils.SourceProperties{})
		require.False(t, s.allowOrphanedUpdate(ctx, errors.New("boom"), old, old, false))
	})
	t.Run("does not apply to managers other than a repository", func(t *testing.T) {
		mgr := utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "tf"}
		old := newObj(t, mgr, utils.SourceProperties{})
		_, err := s.getManager(ctx, old)
		require.NoError(t, err)
	})
}

// ctxCapturingRestConfigProvider records the context each rest config is requested with.
type ctxCapturingRestConfigProvider struct {
	fakeRestConfigProvider
	ctx context.Context
}

func (p *ctxCapturingRestConfigProvider) GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	p.ctx = ctx
	return p.fakeRestConfigProvider.GetRestConfig(ctx)
}

func TestGetRepositoryIdentity(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"kind":"Repository","apiVersion":"provisioning.grafana.app/v0alpha1"}`))
	}))
	t.Cleanup(server.Close)

	callerCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{Login: "caller", OrgRole: identity.RoleNone})

	tests := []struct {
		name                      string
		allowProvisioningIdentity bool
		wantProvisioningIdentity  bool
	}{
		{"runs as the caller by default", false, false},
		{"runs as the provisioning identity when allowed", true, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := &ctxCapturingRestConfigProvider{fakeRestConfigProvider: fakeRestConfigProvider{host: server.URL}}
			s := &Storage{configProvider: provider}

			require.NoError(t, s.getRepository(callerCtx, "default", "my-repo", tt.allowProvisioningIdentity))

			requester, err := identity.GetRequester(provider.ctx)
			require.NoError(t, err)
			require.Equal(t, tt.wantProvisioningIdentity, identity.IsProvisioningServiceIdentity(requester))
		})
	}
}

func TestContentChanged(t *testing.T) {
	newDash := func(t *testing.T, mutate func(*dashboard.Dashboard)) utils.GrafanaMetaAccessor {
		d := &dashboard.Dashboard{ObjectMeta: v1.ObjectMeta{Name: "d", Namespace: "default"}}
		d.Spec.Object = map[string]any{"title": "a"}
		if mutate != nil {
			mutate(d)
		}
		accessor, err := utils.MetaAccessor(d)
		require.NoError(t, err)
		return accessor
	}
	previous := newDash(t, nil)

	t.Run("unchanged", func(t *testing.T) {
		require.False(t, contentChanged(newDash(t, nil), previous))
	})
	t.Run("starting a delete only sets the deletion timestamp", func(t *testing.T) {
		now := v1.Now()
		cur := newDash(t, func(d *dashboard.Dashboard) { d.DeletionTimestamp = &now })
		require.False(t, contentChanged(cur, previous))
	})
	t.Run("label only", func(t *testing.T) {
		cur := newDash(t, func(d *dashboard.Dashboard) { d.Labels = map[string]string{"x": "y"} })
		require.False(t, contentChanged(cur, previous))
	})
	t.Run("spec changed", func(t *testing.T) {
		cur := newDash(t, func(d *dashboard.Dashboard) { d.Spec.Object = map[string]any{"title": "b"} })
		require.True(t, contentChanged(cur, previous))
	})
	t.Run("moved to another folder", func(t *testing.T) {
		cur := newDash(t, nil)
		cur.SetFolder("other")
		require.True(t, contentChanged(cur, previous))
	})
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
