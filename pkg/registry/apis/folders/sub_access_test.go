package folders

import (
	"context"
	"fmt"
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
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestSubAccessREST_getAccessInfo(t *testing.T) {
	type testCase struct {
		name              string
		allowed           map[string]bool // verb -> allowed
		checkErr          error
		itemErr           error // attached to the first BatchCheckItem's result
		parentFolder      string
		expectCanAdmin    bool
		expectCanEdit     bool
		expectCanDelete   bool
		expectCanSave     bool
		expectActionsTier folderTier // tier whose action bundle should appear in AccessControl
		expectNilAC       bool       // when tier is None, AccessControl is nil
		expectErr         bool
		assertItem        func(t *testing.T, item authlib.BatchCheckItem)
	}

	tcs := []testCase{
		{
			name: "setPermissions allowed → Admin tier; all Can* true; admin bundle returned",
			allowed: map[string]bool{
				utils.VerbSetPermissions: true,
			},
			expectCanAdmin:    true,
			expectCanEdit:     true,
			expectCanDelete:   true,
			expectCanSave:     true,
			expectActionsTier: tierAdmin,
		},
		{
			name: "every verb allowed → Admin tier (setPermissions still wins)",
			allowed: map[string]bool{
				utils.VerbGet:            true,
				utils.VerbCreate:         true,
				utils.VerbUpdate:         true,
				utils.VerbDelete:         true,
				utils.VerbSetPermissions: true,
			},
			expectCanAdmin:    true,
			expectCanEdit:     true,
			expectCanDelete:   true,
			expectCanSave:     true,
			expectActionsTier: tierAdmin,
		},
		{
			name: "update + get allowed → Editor tier; CanEdit/CanSave true (gated on update), CanDelete false (no delete verb)",
			allowed: map[string]bool{
				utils.VerbGet:    true,
				utils.VerbUpdate: true,
			},
			expectCanAdmin:    false,
			expectCanEdit:     true,
			expectCanSave:     true,
			expectCanDelete:   false,
			expectActionsTier: tierEditor,
		},
		{
			name: "delete only → Editor tier (promotes AccessControl); only CanDelete true on booleans",
			allowed: map[string]bool{
				utils.VerbDelete: true,
			},
			expectCanAdmin:    false,
			expectCanEdit:     false,
			expectCanSave:     false,
			expectCanDelete:   true,
			expectActionsTier: tierEditor,
		},
		{
			name: "create only → Editor tier (promotes AccessControl); all Can* false (legacy gates CanSave on folders:write, not folders:create)",
			allowed: map[string]bool{
				utils.VerbCreate: true,
			},
			expectCanAdmin:    false,
			expectCanEdit:     false,
			expectCanSave:     false,
			expectCanDelete:   false,
			expectActionsTier: tierEditor,
		},
		{
			name: "get only → Viewer tier; all Can* false; viewer bundle returned",
			allowed: map[string]bool{
				utils.VerbGet: true,
			},
			expectCanAdmin:    false,
			expectCanEdit:     false,
			expectCanDelete:   false,
			expectCanSave:     false,
			expectActionsTier: tierViewer,
		},
		{
			name:        "no access → None tier; all Can* false; AccessControl omitted (nil)",
			allowed:     map[string]bool{},
			expectNilAC: true,
		},
		{
			name:         "request semantics: every folder check targets this folder with parent as folder hint; only folder-resource checks are sent",
			parentFolder: "parent-uid",
			allowed: map[string]bool{
				utils.VerbGet: true,
			},
			assertItem: func(t *testing.T, item authlib.BatchCheckItem) {
				require.Equal(t, folders.GROUP, item.Group, "all checks must target the folder group")
				require.Equal(t, folders.RESOURCE, item.Resource, "all checks must target the folder resource")
				require.Equal(t, "this-folder", item.Name, "every check should target THIS folder")
				require.Equal(t, "parent-uid", item.Folder, "every check should pass the immediate parent as folder hint")
			},
			expectActionsTier: tierViewer,
		},
		{
			name:      "BatchCheck error is propagated",
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

			ac := &subAccessMockClient{
				batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
					if tc.checkErr != nil {
						return authlib.BatchCheckResponse{}, tc.checkErr
					}
					require.Len(t, req.Checks, len(folderTierChecks), "tier resolution sends exactly the folder probes")
					results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
					for idx, item := range req.Checks {
						if tc.assertItem != nil {
							tc.assertItem(t, item)
						}
						res := authlib.BatchCheckResult{Allowed: tc.allowed[item.Verb]}
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
			require.Equal(t, tc.expectCanAdmin, got.CanAdmin, "CanAdmin")
			require.Equal(t, tc.expectCanEdit, got.CanEdit, "CanEdit")
			require.Equal(t, tc.expectCanDelete, got.CanDelete, "CanDelete")
			require.Equal(t, tc.expectCanSave, got.CanSave, "CanSave")

			if tc.expectNilAC {
				require.Nil(t, got.AccessControl, "AccessControl should be nil when tier is None")
				return
			}
			require.Equal(t, actionsForTier(tc.expectActionsTier), got.AccessControl,
				"AccessControl should match the legacy bundle for tier %d", tc.expectActionsTier)
		})
	}
}

func TestSubAccessREST_getAccessInfo_virtualFolders(t *testing.T) {
	t.Run("root/general folder runs real access checks against the general scope without a Get", func(t *testing.T) {
		// "general" and the legacy empty UID must both resolve to the general scope.
		for _, name := range []string{folder.GeneralFolderUID, folder.LegacyRootFolderUID} { //nolint:staticcheck // testing the deprecated legacy empty-string root UID is intentional
			t.Run("name="+strconv.Quote(name), func(t *testing.T) {
				// Bare mock with no expectations: fails if Get is called.
				store := grafanarest.NewMockStorage(t)

				var gotChecks []authlib.BatchCheckItem
				ac := &subAccessMockClient{
					batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
						gotChecks = req.Checks
						results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
						for _, item := range req.Checks {
							// Editor-like: update allowed, but not setPermissions.
							results[item.CorrelationID] = authlib.BatchCheckResult{
								Allowed: item.Verb == utils.VerbGet || item.Verb == utils.VerbUpdate,
							}
						}
						return authlib.BatchCheckResponse{Results: results}, nil
					},
				}

				r := &subAccessREST{getter: store, accessClient: ac}
				ctx := request.WithNamespace(context.Background(), "default")
				ctx = identity.WithRequester(ctx, &user.SignedInUser{UserID: 1, OrgID: 1})

				got, err := r.getAccessInfo(ctx, name)
				require.NoError(t, err)
				require.NotNil(t, got)

				// Legacy empty UID is normalised to "general".
				require.Len(t, gotChecks, len(folderTierChecks))
				for _, item := range gotChecks {
					require.Equal(t, folder.GeneralFolderUID, item.Name, "root checks target the general scope")
					require.Empty(t, item.Folder, "the root folder has no parent")
				}

				require.False(t, got.CanAdmin)
				require.True(t, got.CanEdit)
				require.True(t, got.CanSave)
				require.False(t, got.CanDelete)
				require.Equal(t, actionsForTier(tierEditor), got.AccessControl)
			})
		}
	})

	t.Run("sharedwithme folder reports no access without touching the getter or authz", func(t *testing.T) {
		// Bare getter mock fails if Get is called; BatchCheck fails the test below.
		store := grafanarest.NewMockStorage(t)
		ac := &subAccessMockClient{
			batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, _ authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				t.Fatal("BatchCheck must not be called for the sharedwithme folder")
				return authlib.BatchCheckResponse{}, nil
			},
		}

		r := &subAccessREST{getter: store, accessClient: ac}
		ctx := request.WithNamespace(context.Background(), "default")
		ctx = identity.WithRequester(ctx, &user.SignedInUser{UserID: 1, OrgID: 1})

		got, err := r.getAccessInfo(ctx, folder.SharedWithMeFolderUID)
		require.NoError(t, err)
		require.NotNil(t, got)
		require.False(t, got.CanAdmin)
		require.False(t, got.CanEdit)
		require.False(t, got.CanSave)
		require.False(t, got.CanDelete)
		require.Nil(t, got.AccessControl)
	})
}

// subAccessMockClient is a minimal authlib.AccessClient used by subAccessREST tests.
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
