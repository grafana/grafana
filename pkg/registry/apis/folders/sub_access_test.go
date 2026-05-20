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
	type checkKey struct {
		group, resource, verb string
	}
	type testCase struct {
		name              string
		allowed           map[string]bool // verb -> allowed (folder-domain shorthand)
		allowedByCheck    map[checkKey]bool
		checkErr          error
		itemErr           error // attached to the first BatchCheckItem's result
		parentFolder      string
		expect            folders.FolderAccessInfo
		expectErr         bool
		expectFolderInReq string // verify parent folder is passed to folder-domain checks
		assertItem        func(t *testing.T, item authlib.BatchCheckItem)
	}

	const folderGroup, folderRes = "folder.grafana.app", "folders"
	const dashGroup, dashRes = "dashboard.grafana.app", "dashboards"

	tcs := []testCase{
		{
			name: "admin: every verb allowed → all bools true and full map (folder + dashboard)",
			allowed: map[string]bool{
				utils.VerbGet:            true,
				utils.VerbUpdate:         true,
				utils.VerbDelete:         true,
				utils.VerbCreate:         true,
				utils.VerbGetPermissions: true,
				utils.VerbSetPermissions: true,
			},
			expect: folders.FolderAccessInfo{
				CanSave: true, CanEdit: true, CanAdmin: true, CanDelete: true,
				AccessControl: map[string]bool{
					"folders:read":                 true,
					"folders:write":                true,
					"folders:delete":               true,
					"folders:create":               true,
					"folders.permissions:read":     true,
					"folders.permissions:write":    true,
					"dashboards:read":              true,
					"dashboards:write":             true,
					"dashboards:create":            true,
					"dashboards:delete":            true,
					"dashboards.permissions:read":  true,
					"dashboards.permissions:write": true,
				},
			},
		},
		{
			name: "folder-domain only allowed (no dashboard tuples in Zanzana)",
			allowedByCheck: map[checkKey]bool{
				{group: folderGroup, resource: folderRes, verb: utils.VerbGet}:    true,
				{group: folderGroup, resource: folderRes, verb: utils.VerbUpdate}: true,
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
			name: "dashboard-domain only allowed (folder checks all false)",
			allowedByCheck: map[checkKey]bool{
				{group: dashGroup, resource: dashRes, verb: utils.VerbGet}:    true,
				{group: dashGroup, resource: dashRes, verb: utils.VerbCreate}: true,
			},
			expect: folders.FolderAccessInfo{
				CanSave: false, CanEdit: false, CanAdmin: false, CanDelete: false,
				AccessControl: map[string]bool{
					"dashboards:read":   true,
					"dashboards:create": true,
				},
			},
		},
		{
			name:           "no access: all bools false and AccessControl omitted (nil)",
			allowedByCheck: map[checkKey]bool{},
			expect: folders.FolderAccessInfo{
				CanSave: false, CanEdit: false, CanAdmin: false, CanDelete: false,
				AccessControl: nil,
			},
		},
		{
			name: "permissions-write implies all bools (only folder-domain has the verb)",
			allowedByCheck: map[checkKey]bool{
				{group: folderGroup, resource: folderRes, verb: utils.VerbSetPermissions}: true,
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
			name:         "request semantics: folder-domain uses Name=this, folder hint=parent; cross-domain flips to Name='', folder hint=this",
			parentFolder: "parent-uid",
			allowedByCheck: map[checkKey]bool{
				{group: folderGroup, resource: folderRes, verb: utils.VerbGet}: true,
				{group: dashGroup, resource: dashRes, verb: utils.VerbGet}:     true,
			},
			assertItem: func(t *testing.T, item authlib.BatchCheckItem) {
				switch item.Group {
				case folderGroup:
					require.Equal(t, "this-folder", item.Name, "folder-domain check should target THIS folder")
					require.Equal(t, "parent-uid", item.Folder, "folder-domain check folder hint should be the immediate parent")
				case dashGroup:
					require.Equal(t, "", item.Name, "cross-domain check should use empty Name (any new resource)")
					require.Equal(t, "this-folder", item.Folder, "cross-domain check folder hint should be THIS folder")
				default:
					t.Fatalf("unexpected group in check: %q", item.Group)
				}
			},
			expect: folders.FolderAccessInfo{
				CanSave: false, CanEdit: false, CanAdmin: false, CanDelete: false,
				AccessControl: map[string]bool{
					"folders:read":    true,
					"dashboards:read": true,
				},
			},
		},
		{
			name:      "Check error is propagated",
			checkErr:  fmt.Errorf("authz unavailable"),
			expectErr: true,
		},
		{
			name:      "per-item error is propagated (not silently treated as denied)",
			itemErr:   fmt.Errorf("zanzana lookup failed"),
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
				batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
					if tc.checkErr != nil {
						return authlib.BatchCheckResponse{}, tc.checkErr
					}
					results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
					for idx, item := range req.Checks {
						if tc.assertItem != nil {
							tc.assertItem(t, item)
						}
						if tc.expectFolderInReq != "" {
							require.Equal(t, tc.expectFolderInReq, item.Folder,
								"expected folder=%q on check for verb %q", tc.expectFolderInReq, item.Verb)
						}
						// Fine-grained map wins if set; otherwise fall back to verb-only.
						var allowed bool
						if tc.allowedByCheck != nil {
							allowed = tc.allowedByCheck[checkKey{item.Group, item.Resource, item.Verb}]
						} else {
							allowed = tc.allowed[item.Verb]
						}
						res := authlib.BatchCheckResult{Allowed: allowed}
						if tc.itemErr != nil && idx == 0 {
							res.Error = tc.itemErr
						}
						results[item.CorrelationID] = res
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

// mockAccessClient is a minimal authlib.AccessClient used by subAccessREST tests.
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
