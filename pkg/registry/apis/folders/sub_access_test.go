package folders

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"sync"
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

func TestFolderAccessProbes(t *testing.T) {
	// Enforced downstream on BatchCheck correlation IDs.
	validID := regexp.MustCompile(`^[\w-]{1,36}$`)

	seenID := map[string]bool{}
	seenAction := map[string]bool{}
	for _, p := range folderAccessProbes {
		require.True(t, validID.MatchString(p.correlationID), "correlation ID %q must match [\\w-]{1,36}", p.correlationID)
		require.False(t, seenID[p.correlationID], "duplicate correlation ID %q", p.correlationID)
		seenID[p.correlationID] = true

		require.False(t, seenAction[p.action], "duplicate action %q: each probe must contribute a distinct action", p.action)
		seenAction[p.action] = true

		require.NotEmpty(t, p.group, "probe %q needs a group", p.correlationID)
		require.NotEmpty(t, p.resource, "probe %q needs a resource", p.correlationID)
		require.NotEmpty(t, p.verb, "probe %q needs a verb", p.correlationID)
	}

	// The Can* booleans read these IDs directly.
	for _, id := range []string{"folder-write", "folder-delete", "folder-setperms"} {
		require.True(t, seenID[id], "probe %q is required by the Can* booleans", id)
	}

	// Every action the legacy /api/folders/:uid?accesscontrol=true endpoint could
	// report must be probed, otherwise the UI silently loses a capability. Mirrors
	// Folder/Dashboard/Notebook View+Edit+Admin actions in
	// pkg/services/accesscontrol/ossaccesscontrol/.
	for _, action := range []string{
		"folders:read", "folders:write", "folders:delete", "folders:create",
		"folders.permissions:read", "folders.permissions:write",
		"dashboards:read", "dashboards:create", "dashboards:write", "dashboards:delete",
		"dashboards.permissions:read", "dashboards.permissions:write",
		"annotations:read", "annotations:create", "annotations:write", "annotations:delete",
		"library.panels:read", "library.panels:create", "library.panels:write", "library.panels:delete",
		"variables:read", "variables:create", "variables:write", "variables:delete",
		"notebooks:read", "notebooks:create", "notebooks:write", "notebooks:delete",
		"alert.rules:read", "alert.rules:create", "alert.rules:write", "alert.rules:delete",
		"alert.silences:read", "alert.silences:create", "alert.silences:write",
	} {
		require.True(t, seenAction[action], "legacy action %q is not probed", action)
	}
}

func TestFolderAccessProbeBatches(t *testing.T) {
	// rolloutAccessClient routes a batch by its first item and falls back to
	// RBAC when the items disagree, so every batch must be homogeneous.
	batched := 0
	seenKey := map[string]bool{}
	for _, batch := range folderAccessProbeBatches {
		require.NotEmpty(t, batch.probes, "empty batch")
		first := batch.probes[0]
		key := first.group + "/" + first.resource + "/" + first.subresource
		require.False(t, seenKey[key], "resource %q is split across batches", key)
		seenKey[key] = true

		for _, p := range batch.probes {
			require.Equal(t, first.group, p.group, "batch mixes groups")
			require.Equal(t, first.resource, p.resource, "batch mixes resources")
			require.Equal(t, first.subresource, p.subresource, "batch mixes subresources")
		}
		batched += len(batch.probes)
	}
	require.Equal(t, len(folderAccessProbes), batched, "every probe belongs to exactly one batch")
}

// itemErrProbe is the probe a test case's itemErr is attached to. Naming one
// probe keeps the failure deterministic now that probes span several batches.
const itemErrProbe = "folder-get"

func TestSubAccessREST_getAccessInfo(t *testing.T) {
	type testCase struct {
		name            string
		allowed         []string // correlation IDs the access client allows
		checkErr        error
		itemErr         error // attached to the itemErrProbe result
		parentFolder    string
		expectCanAdmin  bool
		expectCanEdit   bool
		expectCanDelete bool
		expectCanSave   bool
		expectActions   []string // correlation IDs whose actions should be present
		expectNilAC     bool
		expectErr       bool
		assertItems     func(t *testing.T, items []authlib.BatchCheckItem)
	}

	tcs := []testCase{
		{
			name:            "everything allowed → all Can* true and the full action map",
			allowed:         allProbeIDs(),
			expectCanAdmin:  true,
			expectCanEdit:   true,
			expectCanDelete: true,
			expectCanSave:   true,
			expectActions:   allProbeIDs(),
		},
		{
			// The escalation case (https://github.com/grafana/support-escalations/issues/23712): a custom role
			// granting dashboard and alert rule actions at folder scope, without
			// folders:write. These actions used to be dropped because the folder tier
			// resolved to Viewer.
			name: "custom role without folders:write keeps its dashboard and alert rule actions",
			allowed: []string{
				"folder-get",
				"dash-read", "dash-create", "dash-write", "dash-delete",
				"anno-read", "anno-create", "anno-write", "anno-delete",
				"rule-read", "rule-create", "rule-write", "rule-delete",
				"silence-read", "silence-create", "silence-write",
			},
			expectCanAdmin:  false,
			expectCanEdit:   false,
			expectCanSave:   false,
			expectCanDelete: false,
			expectActions: []string{
				"folder-get",
				"dash-read", "dash-create", "dash-write", "dash-delete",
				"anno-read", "anno-create", "anno-write", "anno-delete",
				"rule-read", "rule-create", "rule-write", "rule-delete",
				"silence-read", "silence-create", "silence-write",
			},
		},
		{
			// The inverse: folder edit rights alone must not imply the sub-resource
			// actions the old tier bundle handed out.
			name:            "folders:write alone does not grant dashboards:create",
			allowed:         []string{"folder-get", "folder-write"},
			expectCanAdmin:  false,
			expectCanEdit:   true,
			expectCanSave:   true,
			expectCanDelete: false,
			expectActions:   []string{"folder-get", "folder-write"},
		},
		{
			// Legacy gates CanAdmin on holding both permissions verbs, and does not
			// promote the other flags from it.
			name:           "both permissions verbs → CanAdmin only",
			allowed:        []string{"folder-getperms", "folder-setperms"},
			expectCanAdmin: true,
			expectActions:  []string{"folder-getperms", "folder-setperms"},
		},
		{
			name:          "setPermissions without getPermissions is not admin",
			allowed:       []string{"folder-setperms"},
			expectActions: []string{"folder-setperms"},
		},
		{
			name:            "delete only → CanDelete true, others false",
			allowed:         []string{"folder-delete"},
			expectCanDelete: true,
			expectActions:   []string{"folder-delete"},
		},
		{
			name: "creating subfolders does not imply editing this folder",
			// Legacy gates CanSave on folders:write, not folders:create.
			allowed:       []string{"folder-create"},
			expectActions: []string{"folder-create"},
		},
		{
			name:          "read only → viewer-shaped action map",
			allowed:       []string{"folder-get", "dash-read", "rule-read", "silence-read", "libpanel-read", "var-read", "notebook-read", "anno-read"},
			expectActions: []string{"folder-get", "dash-read", "rule-read", "silence-read", "libpanel-read", "var-read", "notebook-read", "anno-read"},
		},
		{
			name:        "no access → all Can* false; AccessControl omitted (nil)",
			allowed:     nil,
			expectNilAC: true,
		},
		{
			name:         "request semantics: object probes target this folder, in-folder probes target its contents",
			parentFolder: "parent-uid",
			allowed:      []string{"folder-get"},
			assertItems: func(t *testing.T, items []authlib.BatchCheckItem) {
				require.Len(t, items, len(folderAccessProbes), "every probe is sent")

				byID := make(map[string]authlib.BatchCheckItem, len(items))
				for _, item := range items {
					byID[item.CorrelationID] = item
				}

				for _, p := range folderAccessProbes {
					item, ok := byID[p.correlationID]
					require.True(t, ok, "probe %q was not sent", p.correlationID)
					require.Equal(t, p.group, item.Group, "probe %q group", p.correlationID)
					require.Equal(t, p.resource, item.Resource, "probe %q resource", p.correlationID)
					require.Equal(t, p.subresource, item.Subresource, "probe %q subresource", p.correlationID)
					require.Equal(t, p.verb, item.Verb, "probe %q verb", p.correlationID)

					if p.inFolder {
						// "May the user do this inside this folder?" — no object name,
						// this folder as the parent. An empty Folder here would make the
						// check namespace-wide.
						require.Empty(t, item.Name, "in-folder probe %q must not name an object", p.correlationID)
						require.Equal(t, "this-folder", item.Folder, "in-folder probe %q targets this folder", p.correlationID)
						continue
					}
					require.Equal(t, "this-folder", item.Name, "object probe %q targets this folder", p.correlationID)
					require.Equal(t, "parent-uid", item.Folder, "object probe %q passes the parent as folder hint", p.correlationID)
				}
			},
			expectActions: []string{"folder-get"},
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

			allowed := make(map[string]bool, len(tc.allowed))
			for _, id := range tc.allowed {
				allowed[id] = true
			}

			ac := &subAccessMockClient{
				batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
					if tc.checkErr != nil {
						return authlib.BatchCheckResponse{}, tc.checkErr
					}
					results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
					for _, item := range req.Checks {
						res := authlib.BatchCheckResult{Allowed: allowed[item.CorrelationID]}
						if tc.itemErr != nil && item.CorrelationID == itemErrProbe {
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

			require.Equal(t, len(folderAccessProbeBatches), ac.calls(), "one BatchCheck per resource")
			if tc.assertItems != nil {
				tc.assertItems(t, ac.items())
			}
			require.Equal(t, tc.expectCanAdmin, got.CanAdmin, "CanAdmin")
			require.Equal(t, tc.expectCanEdit, got.CanEdit, "CanEdit")
			require.Equal(t, tc.expectCanDelete, got.CanDelete, "CanDelete")
			require.Equal(t, tc.expectCanSave, got.CanSave, "CanSave")

			if tc.expectNilAC {
				require.Nil(t, got.AccessControl, "AccessControl should be nil when nothing is allowed")
				return
			}
			require.Equal(t, actionsOf(t, tc.expectActions...), got.AccessControl,
				"AccessControl should contain exactly the actions of the allowed probes")
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

				ac := &subAccessMockClient{
					batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
						results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
						for _, item := range req.Checks {
							// Editor-like: can edit the folder and create dashboards in it.
							allowed := item.CorrelationID == "folder-get" ||
								item.CorrelationID == "folder-write" ||
								item.CorrelationID == "dash-create"
							results[item.CorrelationID] = authlib.BatchCheckResult{Allowed: allowed}
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
				gotChecks := ac.items()
				require.Len(t, gotChecks, len(folderAccessProbes))
				inFolder := make(map[string]bool, len(folderAccessProbes))
				for _, p := range folderAccessProbes {
					inFolder[p.correlationID] = p.inFolder
				}
				for _, item := range gotChecks {
					if inFolder[item.CorrelationID] {
						require.Empty(t, item.Name, "in-folder probes name no object")
						require.Equal(t, folder.GeneralFolderUID, item.Folder, "in-folder probes target the general scope")
						continue
					}
					require.Equal(t, folder.GeneralFolderUID, item.Name, "object probes target the general scope")
					require.Empty(t, item.Folder, "the root folder has no parent")
				}

				require.False(t, got.CanAdmin)
				require.True(t, got.CanEdit)
				require.True(t, got.CanSave)
				require.False(t, got.CanDelete)
				require.Equal(t, actionsOf(t, "folder-get", "folder-write", "dash-create"), got.AccessControl)
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

// subAccessMockClient is a minimal authlib.AccessClient used by subAccessREST
// tests. checkAccess fans the probes out across goroutines, so the recorded
// items are guarded and only safe to read once getAccessInfo has returned.
type subAccessMockClient struct {
	batchCheckFunc func(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error)

	mu         sync.Mutex
	gotItems   []authlib.BatchCheckItem
	batchCalls int
}

// items returns every BatchCheckItem the client was asked about.
func (m *subAccessMockClient) items() []authlib.BatchCheckItem {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]authlib.BatchCheckItem(nil), m.gotItems...)
}

func (m *subAccessMockClient) calls() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.batchCalls
}

func (m *subAccessMockClient) Check(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{}, nil
}

func (m *subAccessMockClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, nil
}

func (m *subAccessMockClient) BatchCheck(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	m.mu.Lock()
	m.batchCalls++
	m.gotItems = append(m.gotItems, req.Checks...)
	m.mu.Unlock()

	if m.batchCheckFunc != nil {
		return m.batchCheckFunc(ctx, info, req)
	}
	return authlib.BatchCheckResponse{}, nil
}

// actionsOf returns the actions the given probes contribute when allowed.
func actionsOf(t *testing.T, correlationIDs ...string) map[string]bool {
	t.Helper()
	byID := make(map[string]string, len(folderAccessProbes))
	for _, p := range folderAccessProbes {
		byID[p.correlationID] = p.action
	}
	out := make(map[string]bool, len(correlationIDs))
	for _, id := range correlationIDs {
		action, ok := byID[id]
		require.True(t, ok, "unknown probe %q", id)
		out[action] = true
	}
	return out
}

// allProbeIDs returns every probe's correlation ID.
func allProbeIDs() []string {
	ids := make([]string, 0, len(folderAccessProbes))
	for _, p := range folderAccessProbes {
		ids = append(ids, p.correlationID)
	}
	return ids
}
