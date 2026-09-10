package folders

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestSubAccessREST_getAccessInfo(t *testing.T) {
	tests := []struct {
		name        string
		allowed     map[string]bool
		permissions []authlib.Permission
		parents     []string
		want        *folders.FolderAccessInfo
	}{
		{
			name: "silence creation does not require folder or rule write",
			permissions: []authlib.Permission{
				{Action: "folders:read", Scope: "folders:uid:this-folder"},
				{Action: "alert.rules:read", Scope: "folders:uid:this-folder"},
				{Action: "alert.silences:read", Scope: "folders:uid:this-folder"},
				{Action: "alert.silences:create", Scope: "folders:uid:this-folder"},
			},
			want: &folders.FolderAccessInfo{AccessControl: map[string]bool{
				"folders:read": true, "alert.rules:read": true,
				"alert.silences:read": true, "alert.silences:create": true,
			}},
		},
		{
			name: "unrelated folder and resource scopes do not grant silence creation",
			permissions: []authlib.Permission{
				{Action: "folders:read", Scope: "folders:uid:this-folder"},
				{Action: "alert.silences:create", Scope: "folders:uid:other-folder"},
				{Action: "dashboards:write", Scope: "dashboards:uid:this-folder"},
			},
			want: &folders.FolderAccessInfo{AccessControl: map[string]bool{"folders:read": true}},
		},
		{
			name: "folder read does not invent alerting permissions",
			permissions: []authlib.Permission{
				{Action: "folders:read", Scope: "folders:uid:this-folder"},
			},
			want: &folders.FolderAccessInfo{AccessControl: map[string]bool{"folders:read": true}},
		},
		{
			name:    "folder write does not invent silence or rule permissions",
			allowed: map[string]bool{utils.VerbUpdate: true},
			permissions: []authlib.Permission{
				{Action: "folders:write", Scope: "folders:uid:this-folder"},
			},
			want: &folders.FolderAccessInfo{CanEdit: true, CanSave: true,
				AccessControl: map[string]bool{"folders:write": true}},
		},
		{
			name:    "folder administration does not invent subresource permissions",
			allowed: map[string]bool{utils.VerbSetPermissions: true},
			permissions: []authlib.Permission{
				{Action: "folders.permissions:write", Scope: "folders:uid:this-folder"},
			},
			want: &folders.FolderAccessInfo{CanAdmin: true, CanEdit: true, CanSave: true, CanDelete: true,
				AccessControl: map[string]bool{"folders.permissions:write": true}},
		},
		{
			name:    "delete alone does not grant edit",
			allowed: map[string]bool{utils.VerbDelete: true},
			permissions: []authlib.Permission{
				{Action: "folders:delete", Scope: "folders:uid:this-folder"},
			},
			want: &folders.FolderAccessInfo{CanDelete: true,
				AccessControl: map[string]bool{"folders:delete": true}},
		},
		{
			name:    "custom grants inherited from parents and grandparents",
			parents: []string{"parent", "grandparent"},
			permissions: []authlib.Permission{
				{Action: "folders:read", Scope: "folders:uid:this-folder"},
				{Action: "alert.silences:create", Scope: "folders:uid:parent"},
				{Action: "alert.silences:write", Scope: "folders:uid:grandparent"},
				{Action: "library.panels:write", Scope: "folders:uid:grandparent"},
				{Action: "alert.rules:write", Scope: "folders:uid:sibling"},
			},
			want: &folders.FolderAccessInfo{AccessControl: map[string]bool{
				"folders:read": true, "alert.silences:create": true,
				"alert.silences:write": true, "library.panels:write": true,
			}},
		},
		{
			name: "wildcard folder grants are included but unscoped actions are not",
			permissions: []authlib.Permission{
				{Action: "alert.silences:create", Scope: "folders:*"},
				{Action: "alert.silences:read", Scope: "folders:uid:*"},
				{Action: "variables:write", Scope: "*"},
				{Action: "alert.instances:create", Scope: ""},
			},
			want: &folders.FolderAccessInfo{AccessControl: map[string]bool{
				"alert.silences:create": true, "alert.silences:read": true, "variables:write": true,
			}},
		},
		{
			name: "no grants means no metadata",
			want: &folders.FolderAccessInfo{},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := grafanarest.NewMockStorage(t)
			chain := append([]string{"this-folder"}, tc.parents...)
			for i, name := range chain {
				f := &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: name}}
				if i+1 < len(chain) {
					meta, err := utils.MetaAccessor(f)
					require.NoError(t, err)
					meta.SetFolder(chain[i+1])
				}
				store.On("Get", mock.Anything, name, &metav1.GetOptions{}).Return(f, nil).Once()
			}
			ac := &subAccessMockClient{batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				require.Equal(t, "default", req.Namespace)
				require.Len(t, req.Checks, len(folderAccessChecks))
				results := make(map[string]authlib.BatchCheckResult)
				for _, item := range req.Checks {
					require.Equal(t, folders.GROUP, item.Group)
					require.Equal(t, folders.RESOURCE, item.Resource)
					require.Equal(t, "this-folder", item.Name)
					if len(tc.parents) > 0 {
						require.Equal(t, tc.parents[0], item.Folder)
					} else {
						require.Empty(t, item.Folder)
					}
					results[item.CorrelationID] = authlib.BatchCheckResult{Allowed: tc.allowed[item.Verb]}
				}
				return authlib.BatchCheckResponse{Results: results}, nil
			}}
			r := &subAccessREST{getter: store, accessClient: ac, userPermissionsClient: &subAccessPermissionsClient{permissions: tc.permissions}}
			got, err := r.getAccessInfo(subAccessContext(), "this-folder")
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestSubAccessREST_standardFolderRoles(t *testing.T) {
	for _, tc := range []struct {
		name    string
		actions []string
	}{
		{"Viewer", slices.Concat(ossaccesscontrol.FolderViewActions, ossaccesscontrol.DashboardViewActions, ossaccesscontrol.NotebookViewActions)},
		{"Editor", slices.Concat(ossaccesscontrol.FolderEditActions, ossaccesscontrol.DashboardEditActions, ossaccesscontrol.NotebookEditActions)},
		{"Admin", slices.Concat(ossaccesscontrol.FolderAdminActions, ossaccesscontrol.DashboardAdminActions, ossaccesscontrol.NotebookAdminActions)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			permissions := make([]authlib.Permission, 0, len(tc.actions))
			want := make(map[string]bool)
			for _, action := range tc.actions {
				permissions = append(permissions, authlib.Permission{Action: action, Scope: "folders:uid:general"})
				want[action] = true
			}
			r := &subAccessREST{accessClient: &subAccessMockClient{}, userPermissionsClient: &subAccessPermissionsClient{permissions: permissions}}
			got, err := r.getAccessInfo(subAccessContext(), folder.GeneralFolderUID)
			require.NoError(t, err)
			require.Equal(t, want, got.AccessControl)
		})
	}
}

func TestSubAccessREST_errors(t *testing.T) {
	failure := errors.New("authorization unavailable")
	for _, source := range []string{"batch", "item", "permissions", "parent", "cycle"} {
		t.Run(source, func(t *testing.T) {
			store := grafanarest.NewMockStorage(t)
			f := &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "this-folder"}}
			meta, err := utils.MetaAccessor(f)
			require.NoError(t, err)
			if source == "parent" {
				meta.SetFolder("parent")
				store.On("Get", mock.Anything, "parent", &metav1.GetOptions{}).Return(nil, failure)
			}
			if source == "cycle" {
				meta.SetFolder("this-folder")
			}
			store.On("Get", mock.Anything, "this-folder", &metav1.GetOptions{}).Return(f, nil).Once()
			ac := &subAccessMockClient{batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				if source == "batch" {
					return authlib.BatchCheckResponse{}, failure
				}
				if source == "item" {
					return authlib.BatchCheckResponse{Results: map[string]authlib.BatchCheckResult{
						req.Checks[0].CorrelationID: {Error: failure},
					}}, nil
				}
				return authlib.BatchCheckResponse{}, nil
			}}
			permissions := &subAccessPermissionsClient{}
			if source == "permissions" {
				permissions.err = failure
			}
			r := &subAccessREST{getter: store, accessClient: ac, userPermissionsClient: permissions}
			got, err := r.getAccessInfo(subAccessContext(), "this-folder")
			require.Error(t, err)
			require.Nil(t, got)
			if source != "cycle" {
				require.ErrorIs(t, err, failure)
			}
		})
	}
}

func TestSubAccessREST_virtualFolders(t *testing.T) {
	for _, name := range []string{folder.GeneralFolderUID, folder.LegacyRootFolderUID} { //nolint:staticcheck // Exercise normalization of legacy root UIDs.
		t.Run(strconv.Quote(name), func(t *testing.T) {
			ac := &subAccessMockClient{batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				for _, item := range req.Checks {
					require.Equal(t, folder.GeneralFolderUID, item.Name)
					require.Empty(t, item.Folder)
				}
				return authlib.BatchCheckResponse{}, nil
			}}
			r := &subAccessREST{getter: grafanarest.NewMockStorage(t), accessClient: ac,
				userPermissionsClient: &subAccessPermissionsClient{permissions: []authlib.Permission{
					{Action: "folders:read", Scope: "folders:uid:general"},
				}},
			}
			got, err := r.getAccessInfo(subAccessContext(), name)
			require.NoError(t, err)
			require.Equal(t, &folders.FolderAccessInfo{AccessControl: map[string]bool{"folders:read": true}}, got)
		})
	}
	t.Run("sharedwithme does not query storage or authorization", func(t *testing.T) {
		r := &subAccessREST{getter: grafanarest.NewMockStorage(t)}
		got, err := r.getAccessInfo(subAccessContext(), folder.SharedWithMeFolderUID)
		require.NoError(t, err)
		require.Equal(t, &folders.FolderAccessInfo{}, got)
	})
}

func TestSubAccessREST_permissionIdentity(t *testing.T) {
	for _, external := range []bool{false, true} {
		t.Run(strconv.FormatBool(external), func(t *testing.T) {
			requester := &user.SignedInUser{UserID: 1, OrgID: 1, ExternalGroups: []string{"external-team"}}
			permissions := &subAccessPermissionsClient{}
			r := &subAccessREST{accessClient: &subAccessMockClient{}, userPermissionsClient: permissions, useExternalGroups: external}
			ctx := request.WithNamespace(context.Background(), "default")
			ctx = identity.WithRequester(ctx, requester)
			_, err := r.getAccessInfo(ctx, folder.GeneralFolderUID)
			require.NoError(t, err)
			require.Equal(t, "default", permissions.request.Namespace)
			require.Equal(t, "default", permissions.info.GetNamespace())
			require.Equal(t, requester.GetUID(), permissions.info.GetUID())
			require.Equal(t, []string{"authz.grafana.app/userpermissions:get"}, permissions.info.GetTokenDelegatedPermissions())
			if external {
				require.Equal(t, requester.GetExternalGroups(), permissions.info.GetGroups())
			} else {
				require.Equal(t, requester.GetGroups(), permissions.info.GetGroups())
			}
		})
	}
}

func subAccessContext() context.Context {
	ctx := request.WithNamespace(context.Background(), "default")
	return identity.WithRequester(ctx, &user.SignedInUser{UserID: 1, OrgID: 1})
}

type subAccessPermissionsClient struct {
	permissions []authlib.Permission
	err         error
	info        authlib.AuthInfo
	request     authlib.GetUserPermissionsRequest
}

func (m *subAccessPermissionsClient) GetUserPermissions(_ context.Context, info authlib.AuthInfo, req authlib.GetUserPermissionsRequest) (authlib.GetUserPermissionsResponse, error) {
	m.info, m.request = info, req
	return authlib.GetUserPermissionsResponse{Permissions: m.permissions}, m.err
}

func (m *subAccessPermissionsClient) InvalidateUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) error {
	return nil
}

type subAccessMockClient struct {
	batchCheckFunc func(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error)
}

func (m *subAccessMockClient) Check(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{}, nil
}

func (m *subAccessMockClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, nil
}

func (m *subAccessMockClient) BatchCheck(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	if m.batchCheckFunc != nil {
		return m.batchCheckFunc(ctx, info, req)
	}
	return authlib.BatchCheckResponse{}, nil
}
