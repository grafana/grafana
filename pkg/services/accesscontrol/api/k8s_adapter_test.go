package api

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	clientrest "k8s.io/client-go/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/web"
)

// newIAMScheme registers all IAM types needed by the dynamic fake client.
func newIAMScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	scheme := runtime.NewScheme()
	require.NoError(t, iamv0.AddToScheme(scheme))
	require.NoError(t, iamv0.AddGlobalRoleKnownTypes(scheme))
	return scheme
}

// newFakeDynamic creates a dynamicfake client pre-populated with the given objects.
// GlobalRole is cluster-scoped and requires an explicit list-kind mapping.
func newFakeDynamic(t *testing.T, objects ...runtime.Object) *dynamicfake.FakeDynamicClient {
	t.Helper()
	scheme := newIAMScheme(t)
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			iamv0.GlobalRoleInfo.GroupVersionResource(): "GlobalRoleList",
		},
		objects...,
	)
}

// makeUser creates an IAM User with the given name (Grafana UID) and org role.
func makeUser(name, namespace, orgRole string) *iamv0.User {
	u := &iamv0.User{}
	u.TypeMeta = metav1.TypeMeta{APIVersion: iamv0.SchemeGroupVersion.String(), Kind: "User"}
	u.ObjectMeta = metav1.ObjectMeta{Name: name, Namespace: namespace}
	u.Spec.Role = orgRole
	return u
}

// makeRole creates a namespaced Role with the given permissions.
func makeRole(name, namespace string, perms ...accesscontrol.Permission) *iamv0.Role {
	role := &iamv0.Role{}
	role.TypeMeta = metav1.TypeMeta{APIVersion: iamv0.SchemeGroupVersion.String(), Kind: "Role"}
	role.ObjectMeta = metav1.ObjectMeta{Name: name, Namespace: namespace}
	for _, p := range perms {
		role.Spec.Permissions = append(role.Spec.Permissions, iamv0.RolespecPermission{Action: p.Action, Scope: p.Scope})
	}
	return role
}

// makeGlobalRole creates a cluster-scoped GlobalRole with the given permissions.
func makeGlobalRole(name string, perms ...accesscontrol.Permission) *iamv0.GlobalRole {
	gr := &iamv0.GlobalRole{}
	gr.TypeMeta = metav1.TypeMeta{APIVersion: iamv0.SchemeGroupVersion.String(), Kind: "GlobalRole"}
	gr.ObjectMeta = metav1.ObjectMeta{Name: name}
	for _, p := range perms {
		gr.Spec.Permissions = append(gr.Spec.Permissions, iamv0.GlobalRolespecPermission{Action: p.Action, Scope: p.Scope})
	}
	return gr
}

// makeRoleBinding creates a RoleBinding for a user subject pointing at one or more roles.
func makeRoleBinding(name, namespace, userUID string, roleRefs ...iamv0.RoleBindingspecRoleRef) *iamv0.RoleBinding {
	rb := &iamv0.RoleBinding{}
	rb.TypeMeta = metav1.TypeMeta{APIVersion: iamv0.SchemeGroupVersion.String(), Kind: "RoleBinding"}
	rb.ObjectMeta = metav1.ObjectMeta{Name: name, Namespace: namespace}
	rb.Spec.Subject = iamv0.RoleBindingspecSubject{
		Kind: iamv0.RoleBindingSpecSubjectKindUser,
		Name: userUID,
	}
	rb.Spec.RoleRefs = roleRefs
	return rb
}

func roleRef(kind iamv0.RoleBindingSpecRoleRefKind, name string) iamv0.RoleBindingspecRoleRef {
	return iamv0.RoleBindingspecRoleRef{Kind: kind, Name: name}
}

// Test that newK8sPermissionResolver returns nil when restConfigProvider is nil.
func TestNewK8sPermissionResolver_NilProvider(t *testing.T) {
	resolver := newK8sPermissionResolver(nil, nil, nil)
	assert.Nil(t, resolver)
}

// Test that newK8sPermissionResolver creates a resolver when provider is available.
func TestNewK8sPermissionResolver_WithProvider(t *testing.T) {
	provider := &fakeRestConfigProvider{}
	userSvc := &usertest.FakeUserService{}
	resolver := newK8sPermissionResolver(provider, userSvc, nil)
	assert.NotNil(t, resolver)
	assert.Equal(t, provider, resolver.restConfigProvider)
	assert.Equal(t, userSvc, resolver.userService)
	assert.Nil(t, resolver.dynamicClient)
}

// Test SearchUsersPermissions when neither dynamic client nor rest config provider is available.
func TestK8sPermissionResolver_SearchUsersPermissions_NoProvider(t *testing.T) {
	resolver := &k8sPermissionResolver{log: log.New("test")}

	ctx := context.Background()
	caller := &contextmodel.ReqContext{}
	options := accesscontrol.SearchOptions{}

	_, err := resolver.SearchUsersPermissions(ctx, "default", caller, options)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "rest config provider not available")
}

// Test SearchUsersPermissions with a single user query.
func TestK8sPermissionResolver_SearchUsersPermissions_SingleUser(t *testing.T) {
	const ns = "default"

	// Set up K8s objects for user 1 (UID "test-user-uid").
	fakeDyn := newFakeDynamic(t,
		makeUser("test-user-uid", ns, ""),
		makeRole("custom-role", ns,
			accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:*"},
		),
		makeRoleBinding("user-test-user-uid", ns, "test-user-uid",
			roleRef(iamv0.RoleBindingSpecRoleRefKindRole, "custom-role"),
		),
	)

	mockUserSvc := usertest.NewMockService(t)
	mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).
		Return(&user.User{ID: 1, UID: "test-user-uid"}, nil)

	resolver := &k8sPermissionResolver{
		dynamicClient: fakeDyn,
		userService:   mockUserSvc,
		log:           log.New("test"),
	}

	result, err := resolver.SearchUsersPermissions(context.Background(), ns, &contextmodel.ReqContext{},
		accesscontrol.SearchOptions{UserID: 1})
	require.NoError(t, err)
	require.NotNil(t, result)

	perms, ok := result[1]
	require.True(t, ok, "expected permissions for user 1")
	require.Len(t, perms, 1)
	assert.Equal(t, "dashboards:read", perms[0].Action)
}

// Test SearchUsersPermissions with the multi-user (all users) path.
func TestK8sPermissionResolver_SearchUsersPermissions_AllUsers(t *testing.T) {
	const ns = "default"

	// User 1 has dashboards:read via a custom role.
	// User 2 has no role binding → no permissions.
	fakeDyn := newFakeDynamic(t,
		makeUser("uid-user-1", ns, ""),
		makeUser("uid-user-2", ns, ""),
		makeRole("custom-role", ns,
			accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:*"},
		),
		makeRoleBinding("user-uid-user-1", ns, "uid-user-1",
			roleRef(iamv0.RoleBindingSpecRoleRefKindRole, "custom-role"),
		),
	)

	mockUserSvc := usertest.NewMockService(t)
	mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "uid-user-1"}).
		Return(&user.User{ID: 10, UID: "uid-user-1"}, nil).Maybe()
	mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "uid-user-2"}).
		Return(&user.User{ID: 20, UID: "uid-user-2"}, nil).Maybe()

	resolver := &k8sPermissionResolver{
		dynamicClient: fakeDyn,
		userService:   mockUserSvc,
		log:           log.New("test"),
	}

	result, err := resolver.SearchUsersPermissions(context.Background(), ns, &contextmodel.ReqContext{},
		accesscontrol.SearchOptions{ActionPrefix: "dashboards:"})
	require.NoError(t, err)
	require.NotNil(t, result)

	// User 10 (uid-user-1) should have dashboards:read.
	perms10, ok := result[10]
	require.True(t, ok, "expected permissions for user 10")
	require.Len(t, perms10, 1)
	assert.Equal(t, "dashboards:read", perms10[0].Action)

	// User 20 (uid-user-2) has no permissions → not in result.
	_, ok = result[20]
	assert.False(t, ok, "user 20 should not appear in result")
}

// Test that basic org role permissions are fetched via GlobalRole and cached.
func TestK8sPermissionResolver_BasicRolePermissions(t *testing.T) {
	const ns = "default"

	fakeDyn := newFakeDynamic(t,
		makeUser("viewer-uid", ns, "Viewer"),
		makeGlobalRole("basic_viewer",
			accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:*"},
		),
	)

	mockUserSvc := usertest.NewMockService(t)
	mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(5)}).
		Return(&user.User{ID: 5, UID: "viewer-uid"}, nil)

	resolver := &k8sPermissionResolver{
		dynamicClient: fakeDyn,
		userService:   mockUserSvc,
		log:           log.New("test"),
	}

	result, err := resolver.SearchUsersPermissions(context.Background(), ns, &contextmodel.ReqContext{},
		accesscontrol.SearchOptions{UserID: 5})
	require.NoError(t, err)

	perms, ok := result[5]
	require.True(t, ok)
	require.Len(t, perms, 1)
	assert.Equal(t, "dashboards:read", perms[0].Action)
}

// Test filterPermissions with various options.
func TestK8sPermissionResolver_FilterPermissions(t *testing.T) {
	resolver := &k8sPermissionResolver{}

	perms := []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "dashboards:write", Scope: "dashboards:*"},
		{Action: "folders:read", Scope: "folders:*"},
		{Action: "users:read", Scope: "users:*"},
	}

	tests := []struct {
		name     string
		options  accesscontrol.SearchOptions
		expected []accesscontrol.Permission
	}{
		{
			name:     "no filters",
			options:  accesscontrol.SearchOptions{},
			expected: perms,
		},
		{
			name:     "action filter",
			options:  accesscontrol.SearchOptions{Action: "dashboards:read"},
			expected: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:*"}},
		},
		{
			name:    "action prefix filter",
			options: accesscontrol.SearchOptions{ActionPrefix: "dashboards:"},
			expected: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:write", Scope: "dashboards:*"},
			},
		},
		{
			name:     "scope filter",
			options:  accesscontrol.SearchOptions{Scope: "users:*"},
			expected: []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := resolver.filterPermissions(perms, tt.options)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// Test GetActionFilter in the base accesscontrol package.
func TestGetActionFilter(t *testing.T) {
	tests := []struct {
		name    string
		options accesscontrol.SearchOptions
		action  string
		want    bool
	}{
		{
			name:    "exact match",
			options: accesscontrol.SearchOptions{Action: "dashboards:read"},
			action:  "dashboards:read",
			want:    true,
		},
		{
			name:    "exact mismatch",
			options: accesscontrol.SearchOptions{Action: "dashboards:read"},
			action:  "dashboards:write",
			want:    false,
		},
		{
			name:    "prefix match",
			options: accesscontrol.SearchOptions{ActionPrefix: "dashboards:"},
			action:  "dashboards:write",
			want:    true,
		},
		{
			name:    "prefix mismatch",
			options: accesscontrol.SearchOptions{ActionPrefix: "dashboards:"},
			action:  "folders:read",
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filter := accesscontrol.GetActionFilter(tt.options)
			got := filter(tt.action)
			assert.Equal(t, tt.want, got)
		})
	}
}

// Test getUserIDFromUID with user service.
func TestK8sPermissionResolver_GetUserIDFromUID(t *testing.T) {
	tests := []struct {
		name       string
		userSvc    user.Service
		uid        string
		expectedID int64
	}{
		{
			name: "successful lookup",
			userSvc: &usertest.FakeUserService{
				ExpectedUser: &user.User{ID: 42, UID: "test-uid"},
			},
			uid:        "test-uid",
			expectedID: 42,
		},
		{
			name:       "nil user service",
			userSvc:    nil,
			uid:        "test-uid",
			expectedID: 0,
		},
		{
			name: "user not found",
			userSvc: &usertest.FakeUserService{
				ExpectedError: user.ErrUserNotFound,
			},
			uid:        "unknown-uid",
			expectedID: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolver := &k8sPermissionResolver{
				userService: tt.userSvc,
				log:         log.New("test"),
			}

			id := resolver.getUserIDFromUID(context.Background(), tt.uid)
			assert.Equal(t, tt.expectedID, id)
		})
	}
}

func TestK8sPermissionResolver_GetDirectResourcePermissions_GracefulFailures(t *testing.T) {
	t.Run("nil request context", func(t *testing.T) {
		resolver := &k8sPermissionResolver{
			restConfigProvider: &fakeRestConfigProvider{},
			log:                log.New("test"),
		}

		perms, err := resolver.getDirectResourcePermissions(nil, "default", "uid-1")
		require.NoError(t, err)
		require.Empty(t, perms)
	})

	t.Run("subresource unreachable", func(t *testing.T) {
		resolver := &k8sPermissionResolver{
			restConfigProvider: &fakeRestConfigProvider{},
			log:                log.New("test"),
		}
		c := &contextmodel.ReqContext{Context: &web.Context{Req: httptest.NewRequest("GET", "/", nil)}}

		perms, err := resolver.getDirectResourcePermissions(c, "default", "uid-1")
		require.NoError(t, err)
		require.Empty(t, perms)
	})
}

// fakeRestConfigProvider implements DirectRestConfigProvider for testing.
type fakeRestConfigProvider struct{}

func (f *fakeRestConfigProvider) GetDirectRestConfig(_ *contextmodel.ReqContext) *clientrest.Config {
	return &clientrest.Config{Host: "http://localhost"}
}
