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
		allowed           map[string]bool // action -> allowed
		batchCheckErr     error
		parentFolder      string
		expect            folders.FolderAccessInfo
		expectErr         bool
		expectFolderInReq string // verify Folder is propagated to BatchCheck items
	}

	tcs := []testCase{
		{
			name: "admin: every action allowed → all bools true and map fully populated",
			allowed: map[string]bool{
				"folders:read":              true,
				"folders:write":             true,
				"folders:delete":            true,
				"folders:create":            true,
				"folders.permissions:read":  true,
				"folders.permissions:write": true,
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
				"folders:read":  true,
				"folders:write": true,
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
				"folders:read": true,
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
				"folders.permissions:write": true,
			},
			expect: folders.FolderAccessInfo{
				// CanAdmin=true forces CanDelete/CanEdit/CanSave true even though
				// the underlying folders:delete/write/create are not granted.
				CanSave: true, CanEdit: true, CanAdmin: true, CanDelete: true,
				AccessControl: map[string]bool{
					"folders.permissions:write": true,
				},
			},
		},
		{
			name:              "parent folder is propagated to BatchCheck items for inheritance",
			parentFolder:      "parent-uid",
			allowed:           map[string]bool{"folders:read": true},
			expectFolderInReq: "parent-uid",
			expect: folders.FolderAccessInfo{
				CanSave: false, CanEdit: false, CanAdmin: false, CanDelete: false,
				AccessControl: map[string]bool{"folders:read": true},
			},
		},
		{
			name:          "BatchCheck error is propagated",
			batchCheckErr: fmt.Errorf("authz unavailable"),
			expectErr:     true,
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
				batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
					if tc.batchCheckErr != nil {
						return authlib.BatchCheckResponse{}, tc.batchCheckErr
					}
					if tc.expectFolderInReq != "" {
						for _, c := range req.Checks {
							require.Equal(t, tc.expectFolderInReq, c.Folder,
								"expected Folder=%q on BatchCheck item %q", tc.expectFolderInReq, c.CorrelationID)
						}
					}
					results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
					for _, c := range req.Checks {
						results[c.CorrelationID] = authlib.BatchCheckResult{Allowed: tc.allowed[c.CorrelationID]}
					}
					return authlib.BatchCheckResponse{Results: results}, nil
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

// mockAccessClient is a minimal authlib.AccessClient that only implements
// BatchCheck; Check and Compile are unused by subAccessREST.
type mockAccessClient struct {
	batchCheckFunc func(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error)
}

func (m *mockAccessClient) Check(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{}, nil
}

func (m *mockAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, nil
}

func (m *mockAccessClient) BatchCheck(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	if m.batchCheckFunc != nil {
		return m.batchCheckFunc(ctx, info, req)
	}
	return authlib.BatchCheckResponse{}, nil
}
