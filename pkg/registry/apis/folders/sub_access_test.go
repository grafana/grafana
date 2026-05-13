package folders

import (
	"context"
	"fmt"
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
	"github.com/grafana/grafana/pkg/services/user"
)

func TestSubAccessREST_getAccessInfo(t *testing.T) {
	type testCase struct {
		name              string
		allowed           map[string]bool // verb -> allowed
		checkErr          error
		parentFolder      string
		expect            folders.FolderAccessInfo
		expectErr         bool
		expectFolderInReq string // verify parent folder is passed to Check
	}

	tcs := []testCase{
		{
			name: "admin: every verb allowed → all bools true and map fully populated",
			allowed: map[string]bool{
				utils.VerbGet:              true,
				utils.VerbUpdate:           true,
				utils.VerbDelete:           true,
				utils.VerbCreate:           true,
				utils.VerbGetPermissions:   true,
				utils.VerbSetPermissions:   true,
			},
			expect: folders.FolderAccessInfo{
				CanSave: true, CanEdit: true, CanAdmin: true, CanDelete: true,
				AccessControl: map[string]bool{
					"folders:read":              true,
					"folders:write":             true,
					"folders:delete":            true,
					"folders:create":            true,
					"folders.permissions:read":  true,
					"folders.permissions:write": true,
				},
			},
		},
		{
			name: "editor: write+read but no permissions/delete/create",
			allowed: map[string]bool{
				utils.VerbGet:    true,
				utils.VerbUpdate: true,
			},
			expect: folders.FolderAccessInfo{
				CanSave: false, CanEdit: true, CanAdmin: false, CanDelete: false,
				AccessControl: map[string]bool{
					"folders:read":  true,
					"folders:write": true,
				},
			},
		},
		{
			name: "viewer: only read",
			allowed: map[string]bool{
				utils.VerbGet: true,
			},
			expect: folders.FolderAccessInfo{
				CanSave: false, CanEdit: false, CanAdmin: false, CanDelete: false,
				AccessControl: map[string]bool{
					"folders:read": true,
				},
			},
		},
		{
			name:    "no access: all bools false and AccessControl omitted (nil)",
			allowed: map[string]bool{},
			expect: folders.FolderAccessInfo{
				CanSave: false, CanEdit: false, CanAdmin: false, CanDelete: false,
				AccessControl: nil,
			},
		},
		{
			name: "permissions-write implies all other bools",
			allowed: map[string]bool{
				utils.VerbSetPermissions: true,
			},
			expect: folders.FolderAccessInfo{
				// CanAdmin=true forces CanDelete/CanEdit/CanSave true even though
				// the underlying delete/update/create verbs are not granted.
				CanSave: true, CanEdit: true, CanAdmin: true, CanDelete: true,
				AccessControl: map[string]bool{
					"folders.permissions:write": true,
				},
			},
		},
		{
			name:              "parent folder is propagated to Check for inheritance",
			parentFolder:      "parent-uid",
			allowed:           map[string]bool{utils.VerbGet: true},
			expectFolderInReq: "parent-uid",
			expect: folders.FolderAccessInfo{
				CanSave: false, CanEdit: false, CanAdmin: false, CanDelete: false,
				AccessControl: map[string]bool{"folders:read": true},
			},
		},
		{
			name:      "Check error is propagated",
			checkErr:  fmt.Errorf("authz unavailable"),
			expectErr: true,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			// rest.Getter mock returns a folder with the configured parent annotation.
			f := &folders.Folder{}
			meta, err := utils.MetaAccessor(f)
			require.NoError(t, err)
			meta.SetName("this-folder")
			if tc.parentFolder != "" {
				meta.SetFolder(tc.parentFolder)
			}
			store := grafanarest.NewMockStorage(t)
			store.On("Get", mock.Anything, "this-folder", &metav1.GetOptions{}).Return(f, nil)

			ac := &mockAccessClient{
				checkFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
					if tc.checkErr != nil {
						return authlib.CheckResponse{}, tc.checkErr
					}
					if tc.expectFolderInReq != "" {
						require.Equal(t, tc.expectFolderInReq, folder,
							"expected folder=%q on Check for verb %q", tc.expectFolderInReq, req.Verb)
					}
					return authlib.CheckResponse{Allowed: tc.allowed[req.Verb]}, nil
				},
			}

			r := &subAccessREST{getter: store, accessClient: ac}

			ctx := request.WithNamespace(context.Background(), "default")
			ctx = identity.WithRequester(ctx, &user.SignedInUser{UserID: 1, OrgID: 1})

			got, err := r.getAccessInfo(ctx, "this-folder")
			if tc.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, got)
			require.Equal(t, tc.expect.CanSave, got.CanSave, "CanSave")
			require.Equal(t, tc.expect.CanEdit, got.CanEdit, "CanEdit")
			require.Equal(t, tc.expect.CanAdmin, got.CanAdmin, "CanAdmin")
			require.Equal(t, tc.expect.CanDelete, got.CanDelete, "CanDelete")
			require.Equal(t, tc.expect.AccessControl, got.AccessControl, "AccessControl")
		})
	}
}

// mockAccessClient is a minimal authlib.AccessClient used by subAccessREST tests.
type mockAccessClient struct {
	checkFunc func(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error)
}

func (m *mockAccessClient) Check(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	if m.checkFunc != nil {
		return m.checkFunc(ctx, info, req, folder)
	}
	return authlib.CheckResponse{}, nil
}

func (m *mockAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, nil
}

func (m *mockAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, _ authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}
