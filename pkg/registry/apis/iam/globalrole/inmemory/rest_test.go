package inmemory

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func newTestStaticRoles() map[string]*accesscontrol.RoleDTO {
	return map[string]*accesscontrol.RoleDTO{
		"basic:admin": {
			UID:         "basic_admin",
			Name:        "basic:admin",
			DisplayName: "Admin",
			Description: "Admin role",
			Group:       "basic",
			Version:     1,
			Permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:*"},
				{Action: "dashboards:write", Scope: "dashboards:uid:*"},
			},
		},
		"basic:editor": {
			UID:         "basic_editor",
			Name:        "basic:editor",
			DisplayName: "Editor",
			Description: "Editor role",
			Group:       "basic",
			Version:     1,
			Permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:*"},
			},
		},
		"basic:viewer": {
			UID:         "basic_viewer",
			Name:        "basic:viewer",
			DisplayName: "Viewer",
			Description: "Viewer role",
			Group:       "basic",
			Version:     1,
			Permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:*"},
			},
		},
		"basic:grafana_admin": {
			UID:         "basic_grafana_admin",
			Name:        "basic:grafana_admin",
			DisplayName: "Grafana Admin",
			Description: "Grafana Admin role",
			Group:       "basic",
			Version:     1,
			Permissions: []accesscontrol.Permission{
				{Action: "users:read", Scope: ""},
			},
		},
		"basic:none": {
			UID:         "basic_none",
			Name:        "basic:none",
			DisplayName: "No basic role",
			Description: "No basic role",
			Group:       "basic",
			Version:     1,
			Hidden:      true,
		},
	}
}

type mockACService struct {
	accesscontrol.Service
	roles       map[string]*accesscontrol.RoleDTO
	lastCallCtx context.Context
}

func (m *mockACService) GetStaticRoles(ctx context.Context) map[string]*accesscontrol.RoleDTO {
	m.lastCallCtx = ctx
	return m.roles
}

func newTestREST() *ReadOnlyGlobalRoleREST {
	svc := &mockACService{roles: newTestStaticRoles()}
	return NewReadOnlyGlobalRoleREST(svc)
}

func TestGetReturnsCorrectRole(t *testing.T) {
	r := newTestREST()
	obj, err := r.Get(context.Background(), "basic_admin", &metav1.GetOptions{})
	require.NoError(t, err)
	require.NotNil(t, obj)

	role, ok := obj.(*iamv0.GlobalRole)
	require.True(t, ok)
	assert.Equal(t, "basic_admin", role.Name)
	assert.Equal(t, "Admin", role.Spec.Title)
	assert.Equal(t, "Admin role", role.Spec.Description)
	assert.Equal(t, "basic", role.Spec.Group)
	require.Len(t, role.Spec.Permissions, 2)
}

func TestGetReturnsNotFound(t *testing.T) {
	r := newTestREST()
	_, err := r.Get(context.Background(), "nonexistent", &metav1.GetOptions{})
	require.Error(t, err)
	assert.True(t, apierrors.IsNotFound(err))
}

func TestListReturnsAllRolesWithPermissions(t *testing.T) {
	r := newTestREST()
	obj, err := r.List(context.Background(), nil)
	require.NoError(t, err)
	require.NotNil(t, obj)

	list, ok := obj.(*iamv0.GlobalRoleList)
	require.True(t, ok)
	require.Len(t, list.Items, 5)

	// Build a name->role map for stable assertions
	roleMap := make(map[string]iamv0.GlobalRole, len(list.Items))
	for _, item := range list.Items {
		roleMap[item.Name] = item
	}

	// Verify admin role has permissions
	admin, ok := roleMap["basic_admin"]
	require.True(t, ok)
	require.Len(t, admin.Spec.Permissions, 2)
	assert.Equal(t, "dashboards:read", admin.Spec.Permissions[0].Action)

	// Verify the none role has hidden annotation
	none, ok := roleMap["basic_none"]
	require.True(t, ok)
	assert.Equal(t, "true", none.Annotations[accesscontrol.RoleHiddenAnnotation])
}

func TestCreateReturnsMethodNotSupported(t *testing.T) {
	r := newTestREST()
	_, err := r.Create(context.Background(), nil, nil, &metav1.CreateOptions{})
	require.Error(t, err)
	assert.True(t, apierrors.IsMethodNotSupported(err))
}

func TestUpdateReturnsMethodNotSupported(t *testing.T) {
	r := newTestREST()
	_, _, err := r.Update(context.Background(), "test", nil, nil, nil, false, &metav1.UpdateOptions{})
	require.Error(t, err)
	assert.True(t, apierrors.IsMethodNotSupported(err))
}

func TestDeleteReturnsMethodNotSupported(t *testing.T) {
	r := newTestREST()
	_, _, err := r.Delete(context.Background(), "test", nil, &metav1.DeleteOptions{})
	require.Error(t, err)
	assert.True(t, apierrors.IsMethodNotSupported(err))
}

func TestDeleteCollectionReturnsMethodNotSupported(t *testing.T) {
	r := newTestREST()
	_, err := r.DeleteCollection(context.Background(), nil, &metav1.DeleteOptions{}, nil)
	require.Error(t, err)
	assert.True(t, apierrors.IsMethodNotSupported(err))
}

func TestNamespaceScoped(t *testing.T) {
	r := newTestREST()
	assert.False(t, r.NamespaceScoped())
}

func TestGetSwitchesToServiceIdentity(t *testing.T) {
	svc := &mockACService{roles: newTestStaticRoles()}
	r := NewReadOnlyGlobalRoleREST(svc)

	_, err := r.Get(context.Background(), "basic_admin", &metav1.GetOptions{})
	require.NoError(t, err)
	assert.True(t, identity.IsServiceIdentity(svc.lastCallCtx))
}

func TestListSwitchesToServiceIdentity(t *testing.T) {
	svc := &mockACService{roles: newTestStaticRoles()}
	r := NewReadOnlyGlobalRoleREST(svc)

	_, err := r.List(context.Background(), nil)
	require.NoError(t, err)
	assert.True(t, identity.IsServiceIdentity(svc.lastCallCtx))
}

func TestConvertToTable(t *testing.T) {
	r := newTestREST()
	obj, err := r.Get(context.Background(), "basic_admin", &metav1.GetOptions{})
	require.NoError(t, err)

	table, err := r.ConvertToTable(context.Background(), obj, nil)
	require.NoError(t, err)
	require.NotNil(t, table)
	require.Len(t, table.Rows, 1)
}
