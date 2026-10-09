package server

// Parity harness: one RBAC grant fixture is fed to both authorization engines
// and the two answers are compared.
//
//	permissions ([]accesscontrol.Permission) + folder tree
//	   ├─► RBAC:    rbac.NewTestService -> Service.Check / Service.List / Service.BatchCheck
//	   └─► Zanzana: common.TranslateToResourceTuples -> OpenFGA tuples -> Server.Check / Server.List / Server.BatchCheck
//
// Both engines are driven through their public entry points, so a difference
// here is a real behavioural difference and not an artefact of the harness.
//
// A case has one of two modes:
//
//   - Enforced (the default). The engines agree today, so any divergence fails
//     the test. This is what stops a regression from landing.
//   - Open gap. The engines already disagree; the case records Zanzana's current
//     answer in zanzanaToday plus a divergence note, and is reported rather than
//     failed. These are bugs to fix, but a permanently red suite gets ignored,
//     so they stay green until someone closes them.
//
// Closing a gap means deleting zanzanaToday and divergence, which flips the case
// to enforced. The runner logs RESOLVED when it notices a gap has closed, so it
// tells you when that is possible.

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	rbacstore "github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	paritySubject = "user:test-uid"
	parityUserUID = "test-uid"
)

// ---------------------------------------------------------------------------
// Check parity
// ---------------------------------------------------------------------------

type checkParityCase struct {
	name        string
	permissions []accesscontrol.Permission
	folders     []rbacstore.Folder
	req         *authzv1.CheckRequest

	// expected is what the RBAC service answers.
	expected bool
	// zanzanaToday, when set, marks this case as an open gap and records what
	// Zanzana answers while the gap is open. Reported, not asserted.
	zanzanaToday *bool
	// divergence explains the gap. Required whenever zanzanaToday is set.
	divergence string
}

func TestIntegrationRBACParityCheck(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testCases := []checkParityCase{
		// -- direct resource grants -----------------------------------------
		{
			name:        "dashboard get with matching uid grant",
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:dash1"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", ""),
			expected:    true,
		},
		{
			name:        "dashboard get with grant on a different uid",
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:dash2"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", ""),
			expected:    false,
		},
		{
			name:        "dashboard get with uid wildcard grant",
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:*"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", ""),
			expected:    true,
		},
		{
			name:        "dashboard delete via dashboards:admin action set on the object",
			permissions: []accesscontrol.Permission{{Action: "dashboards:admin", Scope: "dashboards:uid:dash1"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbDelete, "dash1", ""),
			expected:    true,
		},

		// -- folder inheritance ---------------------------------------------
		{
			name:        "dashboard get via grant on its parent folder",
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", "folder1"),
			expected:    true,
		},
		{
			name:        "dashboard get with grant on an unrelated folder",
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}, {UID: "folder2"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", "folder2"),
			expected:    false,
		},
		{
			name:        "dashboard get inherits down the folder tree",
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "folders:uid:parent"}},
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", "child"),
			expected:    true,
		},
		{
			name:        "dashboard get does not inherit up the folder tree",
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "folders:uid:child"}},
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", "parent"),
			expected:    false,
		},
		{
			name:        "dashboard get denied by folders:read on its parent folder",
			permissions: []accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", "folder1"),
			expected:    false,
		},
		{
			name:        "dashboard get denied by folders:read on an ancestor folder",
			permissions: []accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:parent"}},
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", "child"),
			expected:    false,
		},
		{
			name:        "dashboard get via folders:view action set",
			permissions: []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", "folder1"),
			expected:    true,
		},
		{
			name:        "dashboard get via folders:view action set on an ancestor folder",
			permissions: []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:parent"}},
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", "child"),
			expected:    true,
		},
		{
			name:        "dashboard update via folders:edit action set",
			permissions: []accesscontrol.Permission{{Action: "folders:edit", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbUpdate, "dash1", "folder1"),
			expected:    true,
		},
		{
			name:        "dashboard update denied by folders:view action set",
			permissions: []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbUpdate, "dash1", "folder1"),
			expected:    false,
		},

		// -- create and the general folder ----------------------------------
		{
			name:        "dashboard create in a folder",
			permissions: []accesscontrol.Permission{{Action: "folders:edit", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbCreate, "", "folder1"),
			expected:    true,
		},
		{
			name:        "dashboard create at the root maps the empty parent to general",
			permissions: []accesscontrol.Permission{{Action: "folders:edit", Scope: "folders:uid:general"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbCreate, "", ""),
			expected:    true,
		},
		{
			name:        "dashboard get at the root does not map the empty parent to general",
			permissions: []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:general"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", ""),
			expected:    false,
		},

		// -- folders ---------------------------------------------------------
		{
			name:        "folder get with direct grant",
			permissions: []accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(folderGroup, folderResource, "", utils.VerbGet, "folder1", ""),
			expected:    true,
		},
		{
			name:        "folder get on a child via a grant on the parent",
			permissions: []accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:parent"}},
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}},
			req:         parityCheckReq(folderGroup, folderResource, "", utils.VerbGet, "child", "parent"),
			expected:    true,
		},
		{
			name:        "folder create at the root",
			permissions: []accesscontrol.Permission{{Action: "folders:edit", Scope: "folders:uid:general"}},
			req:         parityCheckReq(folderGroup, folderResource, "", utils.VerbCreate, "", ""),
			expected:    true,
		},
		{
			name:        "subfolder create under the parent folder",
			permissions: []accesscontrol.Permission{{Action: "folders:edit", Scope: "folders:uid:parent"}},
			folders:     []rbacstore.Folder{{UID: "parent"}},
			req:         parityCheckReq(folderGroup, folderResource, "", utils.VerbCreate, "", "parent"),
			expected:    true,
		},
		{
			name:        "folder delete denied by folders:view action set",
			permissions: []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(folderGroup, folderResource, "", utils.VerbDelete, "folder1", ""),
			expected:    false,
		},
		{
			name:        "folder set_permissions via folders:admin action set",
			permissions: []accesscontrol.Permission{{Action: "folders:admin", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(folderGroup, folderResource, "", utils.VerbSetPermissions, "folder1", ""),
			expected:    true,
		},
		{
			name:        "folder get_permissions denied by folders:edit action set",
			permissions: []accesscontrol.Permission{{Action: "folders:edit", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(folderGroup, folderResource, "", utils.VerbGetPermissions, "folder1", ""),
			expected:    false,
		},

		// -- variables: the empty-parent special case ------------------------
		{
			name:        "variable get inside a folder",
			permissions: []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(dashboardGroup, "variables", "", utils.VerbGet, "region", "folder1"),
			expected:    true,
		},
		{
			name:        "variable create at the root maps the empty parent to general",
			permissions: []accesscontrol.Permission{{Action: "folders:edit", Scope: "folders:uid:general"}},
			req:         parityCheckReq(dashboardGroup, "variables", "", utils.VerbCreate, "region", ""),
			expected:    true,
		},
		{
			name:        "variable get at the root maps the empty parent to general",
			permissions: []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:general"}},
			req:         parityCheckReq(dashboardGroup, "variables", "", utils.VerbGet, "region", ""),
			expected:    true,
		},
		{
			name:        "variable update at the root maps the empty parent to general",
			permissions: []accesscontrol.Permission{{Action: "folders:edit", Scope: "folders:uid:general"}},
			req:         parityCheckReq(dashboardGroup, "variables", "", utils.VerbUpdate, "region", ""),
			expected:    true,
		},

		// -- subresources ----------------------------------------------------
		{
			name:         "dashboard annotation get via the dashboard-scoped annotation action",
			permissions:  []accesscontrol.Permission{{Action: "annotations:read", Scope: "dashboards:uid:dash1"}},
			req:          parityCheckReq(dashboardGroup, dashboardResource, "annotations", utils.VerbGet, "dash1", ""),
			expected:     true,
			zanzanaToday: new(false),
			divergence: "Zanzana's translation table has no entry for the annotations:* actions, so the grant " +
				"produces no tuple at all. RBAC maps the annotations subresource onto annotations:read " +
				"scoped to the dashboard.",
		},
		{
			name:        "dashboard annotation get via folders:view on the parent folder",
			permissions: []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "annotations", utils.VerbGet, "dash1", "folder1"),
			expected:    true,
		},

		// -- teams (a typed, non-folder resource) ----------------------------
		{
			name:        "team get with matching uid grant",
			permissions: []accesscontrol.Permission{{Action: "teams:read", Scope: "teams:uid:t1"}},
			req:         parityCheckReq(teamGroup, teamResource, "", utils.VerbGet, "t1", ""),
			expected:    true,
		},
		{
			name:        "team get with grant on a different uid",
			permissions: []accesscontrol.Permission{{Action: "teams:read", Scope: "teams:uid:t1"}},
			req:         parityCheckReq(teamGroup, teamResource, "", utils.VerbGet, "t2", ""),
			expected:    false,
		},
		{
			name:        "team create needs no scope",
			permissions: []accesscontrol.Permission{{Action: "teams:create"}},
			req:         parityCheckReq(teamGroup, teamResource, "", utils.VerbCreate, "", ""),
			expected:    true,
		},

		// -- capabilities probes (no name, no folder) ------------------------
		{
			name:         "dashboard list with a single object grant",
			permissions:  []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:dash1"}},
			req:          parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbList, "", ""),
			expected:     true,
			zanzanaToday: new(false),
			divergence: "A check with no name is a capabilities probe. RBAC answers \"does the user hold this " +
				"action on anything\" and allows it, leaving result narrowing to the caller. Zanzana has no " +
				"equivalent: an empty name only lets it test the group_resource object, which a per-object " +
				"grant does not satisfy.",
		},
		{
			name:        "dashboard list with a wildcard grant",
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:*"}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbList, "", ""),
			expected:    true,
		},
		{
			name:        "dashboard list without any grant",
			permissions: []accesscontrol.Permission{},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbList, "", ""),
			expected:    false,
		},
	}

	srv := setupOpenFGAServer(t)
	gaps := &parityGaps{}
	defer gaps.report(t, len(testCases))

	for i, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.zanzanaToday != nil {
				require.NotEmpty(t, tc.divergence, "an open gap must document why the engines differ")
			}

			ns := parityNamespace(i)
			req := parityWithNamespace(tc.req, ns)

			rbacRes, err := rbac.NewTestService(parityUserUID, tc.permissions, tc.folders).
				Check(newContextWithNamespace(), req)
			require.NoError(t, err)
			gotRBAC := rbacRes.GetAllowed()
			require.Equal(t, tc.expected, gotRBAC,
				"RBAC answer changed; update the case before touching the parity expectation")

			writeParityTuples(t, srv, ns, tc.permissions, tc.folders)
			zanzanaRes, err := srv.Check(newContextWithNamespace(), req)
			require.NoError(t, err)

			compareEngines(t, gaps, tc.name, tc.expected, tc.zanzanaToday, tc.divergence,
				zanzanaRes.GetAllowed(), gotRBAC)
		})
	}
}

// ---------------------------------------------------------------------------
// List parity
// ---------------------------------------------------------------------------

type listParityCase struct {
	name        string
	permissions []accesscontrol.Permission
	folders     []rbacstore.Folder
	req         *authzv1.ListRequest

	// expected is what the RBAC service answers.
	expected parityListResult
	// zanzanaToday, when set, marks this case as an open gap and records what
	// Zanzana answers while the gap is open. Reported, not asserted.
	zanzanaToday *parityListResult
	// divergence explains the gap. Required whenever zanzanaToday is set.
	divergence string
}

type parityListResult struct {
	All     bool
	Items   []string
	Folders []string
}

func TestIntegrationRBACParityList(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testCases := []listParityCase{
		{
			name: "dashboards with object and folder grants",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:dash1"},
				{Action: "dashboards:read", Scope: "dashboards:uid:dash2"},
				{Action: "dashboards:read", Scope: "folders:uid:folder1"},
			},
			folders:  []rbacstore.Folder{{UID: "folder1"}},
			req:      parityListReq(dashboardGroup, dashboardResource, "", utils.VerbGet),
			expected: parityListResult{Items: []string{"dash1", "dash2"}, Folders: []string{"folder1"}},
		},
		{
			name:        "dashboards folder grant expands to descendants",
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "folders:uid:parent"}},
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}},
			req:         parityListReq(dashboardGroup, dashboardResource, "", utils.VerbGet),
			expected:    parityListResult{Folders: []string{"parent", "child"}},
		},
		{
			name:        "dashboards via folders:view action set",
			permissions: []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityListReq(dashboardGroup, dashboardResource, "", utils.VerbGet),
			expected:    parityListResult{Folders: []string{"folder1"}},
		},
		{
			name:        "dashboards via folders:view action set includes descendants",
			permissions: []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:parent"}},
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}},
			req:         parityListReq(dashboardGroup, dashboardResource, "", utils.VerbGet),
			expected:    parityListResult{Folders: []string{"parent", "child"}},
		},
		{
			name:        "dashboards excluded by folders:read on their parent folder",
			permissions: []accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:folder1"}},
			folders:     []rbacstore.Folder{{UID: "folder1"}},
			req:         parityListReq(dashboardGroup, dashboardResource, "", utils.VerbGet),
			expected:    parityListResult{},
		},
		{
			name:        "dashboards excluded by folders:read on an ancestor folder",
			permissions: []accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:parent"}},
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}},
			req:         parityListReq(dashboardGroup, dashboardResource, "", utils.VerbGet),
			expected:    parityListResult{},
		},
		{
			name:        "dashboards with a wildcard grant",
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:*"}},
			req:         parityListReq(dashboardGroup, dashboardResource, "", utils.VerbGet),
			expected:    parityListResult{All: true},
		},
		{
			name:        "dashboards without any grant",
			permissions: []accesscontrol.Permission{},
			req:         parityListReq(dashboardGroup, dashboardResource, "", utils.VerbGet),
			expected:    parityListResult{},
		},
		{
			name:        "folders grant expands to descendants",
			permissions: []accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:parent"}},
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}},
			req:         parityListReq(folderGroup, folderResource, "", utils.VerbGet),
			expected:    parityListResult{Items: []string{"parent", "child"}},
		},
		{
			name:        "variables with a grant on general",
			permissions: []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:general"}},
			req:         parityListReq(dashboardGroup, "variables", "", utils.VerbList),
			expected:    parityListResult{Folders: []string{"general", ""}},
		},
	}

	srv := setupOpenFGAServer(t)
	gaps := &parityGaps{}
	defer gaps.report(t, len(testCases))

	for i, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.zanzanaToday != nil {
				require.NotEmpty(t, tc.divergence, "an open gap must document why the engines differ")
			}

			ns := parityNamespace(i)
			req := parityWithNamespace(tc.req, ns)

			rbacRes, err := rbac.NewTestService(parityUserUID, tc.permissions, tc.folders).
				List(newContextWithNamespace(), req)
			require.NoError(t, err)
			gotRBAC := toParityListResult(rbacRes)
			require.Equal(t, normalizeParityList(tc.expected), gotRBAC,
				"RBAC answer changed; update the case before touching the parity expectation")

			writeParityTuples(t, srv, ns, tc.permissions, tc.folders)
			zanzanaRes, err := srv.List(newContextWithNamespace(), req)
			require.NoError(t, err)

			compareEngines(t, gaps, tc.name, normalizeParityList(tc.expected),
				normalizeParityListPtr(tc.zanzanaToday), tc.divergence,
				toParityListResult(zanzanaRes), gotRBAC)
		})
	}
}

// ---------------------------------------------------------------------------
// BatchCheck parity
// ---------------------------------------------------------------------------

func TestIntegrationRBACParityBatchCheck(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testCases := []struct {
		name     string
		action   string
		expected map[string]bool
	}{
		{
			name:   "folders:read grants folders but not dashboards",
			action: "folders:read",
			expected: map[string]bool{
				"folder-parent":    true,
				"folder-child":     true,
				"dashboard-parent": false,
				"dashboard-child":  false,
			},
		},
		{
			name:   "folders:view grants folders and dashboards",
			action: "folders:view",
			expected: map[string]bool{
				"folder-parent":    true,
				"folder-child":     true,
				"dashboard-parent": true,
				"dashboard-child":  true,
			},
		},
	}

	srv := setupOpenFGAServer(t)
	for i, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ns := parityNamespace(i)
			permissions := []accesscontrol.Permission{{Action: tc.action, Scope: "folders:uid:parent"}}
			folders := []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}}
			req := &authzv1.BatchCheckRequest{
				Namespace: ns,
				Subject:   paritySubject,
				Checks: []*authzv1.BatchCheckItem{
					{CorrelationId: "folder-parent", Group: folderGroup, Resource: folderResource, Verb: utils.VerbGet, Name: "parent"},
					{CorrelationId: "folder-child", Group: folderGroup, Resource: folderResource, Verb: utils.VerbGet, Name: "child", Folder: "parent"},
					{CorrelationId: "dashboard-parent", Group: dashboardGroup, Resource: dashboardResource, Verb: utils.VerbGet, Name: "dash-parent", Folder: "parent"},
					{CorrelationId: "dashboard-child", Group: dashboardGroup, Resource: dashboardResource, Verb: utils.VerbGet, Name: "dash-child", Folder: "child"},
				},
			}

			rbacRes, err := rbac.NewTestService(parityUserUID, permissions, folders).
				BatchCheck(newContextWithNamespace(), proto.Clone(req).(*authzv1.BatchCheckRequest))
			require.NoError(t, err)
			require.Len(t, rbacRes.GetResults(), len(tc.expected))

			writeParityTuples(t, srv, ns, permissions, folders)
			zanzanaRes, err := srv.BatchCheck(newContextWithNamespace(), proto.Clone(req).(*authzv1.BatchCheckRequest))
			require.NoError(t, err)
			require.Len(t, zanzanaRes.GetResults(), len(tc.expected))

			for _, item := range req.GetChecks() {
				id := item.GetCorrelationId()
				t.Run(id, func(t *testing.T) {
					require.Contains(t, rbacRes.GetResults(), id)
					require.Contains(t, zanzanaRes.GetResults(), id)
					rbacResult := rbacRes.GetResults()[id]
					zanzanaResult := zanzanaRes.GetResults()[id]
					require.Empty(t, rbacResult.GetError())
					require.Empty(t, zanzanaResult.GetError())
					require.Equal(t, tc.expected[id], rbacResult.GetAllowed(), "RBAC answer changed")
					assert.Equal(t, tc.expected[id], zanzanaResult.GetAllowed(), "Zanzana diverges from RBAC")
				})
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Folder write and permission parity
// ---------------------------------------------------------------------------

func TestIntegrationRBACParityFolderWrites(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	operations := []struct {
		verb                  string
		folderAction          string
		dashboardAction       string
		folderEditAllowed     bool
		dashboardEditAllowed  bool
		dashboardAdminAllowed bool
	}{
		// Dashboard action sets manage existing dashboards; creation belongs to folder Edit/Admin.
		{utils.VerbCreate, "folders:create", "dashboards:create", true, false, false},
		{utils.VerbUpdate, "folders:write", "dashboards:write", true, true, true},
		{utils.VerbDelete, "folders:delete", "dashboards:delete", true, true, true},
		{utils.VerbGetPermissions, "folders.permissions:read", "dashboards.permissions:read", false, false, true},
		{utils.VerbSetPermissions, "folders.permissions:write", "dashboards.permissions:write", false, false, true},
	}

	srv := setupOpenFGAServer(t)
	namespaceIndex := 0
	for _, op := range operations {
		t.Run(op.verb, func(t *testing.T) {
			grants := []struct {
				action  string
				allowed bool
			}{
				{op.folderAction, false},
				{op.dashboardAction, true},
				{"folders:view", false},
				{"folders:edit", op.folderEditAllowed},
				{"folders:admin", true},
				{"dashboards:view", false},
				{"dashboards:edit", op.dashboardEditAllowed},
				{"dashboards:admin", op.dashboardAdminAllowed},
			}
			for _, grant := range grants {
				t.Run(grant.action, func(t *testing.T) {
					ns := parityNamespace(namespaceIndex)
					namespaceIndex++
					permissions := []accesscontrol.Permission{{Action: grant.action, Scope: "folders:uid:parent"}}
					folders := []rbacstore.Folder{
						{UID: "parent"},
						{UID: "child", ParentUID: new("parent")},
						{UID: "unrelated"},
					}
					rbacService := rbac.NewTestService(parityUserUID, permissions, folders)
					writeParityTuples(t, srv, ns, permissions, folders)

					name := "dash1"
					if op.verb == utils.VerbCreate {
						name = ""
					}
					targets := []struct {
						folder  string
						allowed bool
					}{
						{"parent", grant.allowed},
						{"child", grant.allowed},
						{"unrelated", false},
					}

					t.Run("Check", func(t *testing.T) {
						for _, target := range targets {
							t.Run(target.folder, func(t *testing.T) {
								req := parityCheckReq(dashboardGroup, dashboardResource, "", op.verb, name, target.folder)
								rbacRes, err := rbacService.Check(newContextWithNamespace(), parityWithNamespace(req, ns))
								require.NoError(t, err)
								require.Equal(t, target.allowed, rbacRes.GetAllowed(), "RBAC answer changed")
								zanzanaRes, err := srv.Check(newContextWithNamespace(), parityWithNamespace(req, ns))
								require.NoError(t, err)
								assert.Equal(t, target.allowed, zanzanaRes.GetAllowed(), "Zanzana diverges from RBAC")
							})
						}
					})

					t.Run("List", func(t *testing.T) {
						expected := parityListResult{}
						if grant.allowed {
							expected.Folders = []string{"parent", "child"}
						}
						req := parityListReq(dashboardGroup, dashboardResource, "", op.verb)
						rbacRes, err := rbacService.List(newContextWithNamespace(), parityWithNamespace(req, ns))
						require.NoError(t, err)
						require.Equal(t, normalizeParityList(expected), toParityListResult(rbacRes), "RBAC answer changed")
						zanzanaRes, err := srv.List(newContextWithNamespace(), parityWithNamespace(req, ns))
						require.NoError(t, err)
						assert.Equal(t, normalizeParityList(expected), toParityListResult(zanzanaRes), "Zanzana diverges from RBAC")
					})

					t.Run("BatchCheck", func(t *testing.T) {
						req := &authzv1.BatchCheckRequest{Namespace: ns, Subject: paritySubject}
						for _, target := range targets {
							req.Checks = append(req.Checks, &authzv1.BatchCheckItem{
								CorrelationId: target.folder,
								Group:         dashboardGroup,
								Resource:      dashboardResource,
								Verb:          op.verb,
								Name:          name,
								Folder:        target.folder,
							})
						}
						rbacRes, err := rbacService.BatchCheck(newContextWithNamespace(), proto.Clone(req).(*authzv1.BatchCheckRequest))
						require.NoError(t, err)
						require.Len(t, rbacRes.GetResults(), len(targets))
						zanzanaRes, err := srv.BatchCheck(newContextWithNamespace(), proto.Clone(req).(*authzv1.BatchCheckRequest))
						require.NoError(t, err)
						require.Len(t, zanzanaRes.GetResults(), len(targets))
						for _, target := range targets {
							t.Run(target.folder, func(t *testing.T) {
								require.Contains(t, rbacRes.GetResults(), target.folder)
								require.Contains(t, zanzanaRes.GetResults(), target.folder)
								rbacResult := rbacRes.GetResults()[target.folder]
								zanzanaResult := zanzanaRes.GetResults()[target.folder]
								require.Empty(t, rbacResult.GetError())
								require.Empty(t, zanzanaResult.GetError())
								require.Equal(t, target.allowed, rbacResult.GetAllowed(), "RBAC answer changed")
								assert.Equal(t, target.allowed, zanzanaResult.GetAllowed(), "Zanzana diverges from RBAC")
							})
						}
					})
				})
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Wildcard dashboard creation parity
// ---------------------------------------------------------------------------

func TestIntegrationRBACParityDashboardWildcardCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	grants := []struct {
		action  string
		allowed bool
	}{
		{"dashboards:view", false},
		{"dashboards:edit", false},
		{"dashboards:admin", false},
		{"dashboards:create", true},
	}

	srv := setupOpenFGAServer(t)
	namespaceIndex := 0
	for _, scope := range []string{"dashboards:uid:*", "folders:uid:*"} {
		t.Run(scope, func(t *testing.T) {
			for _, grant := range grants {
				t.Run(grant.action, func(t *testing.T) {
					ns := parityNamespace(namespaceIndex)
					namespaceIndex++
					permissions := []accesscontrol.Permission{{Action: grant.action, Scope: scope}}
					folders := []rbacstore.Folder{{UID: "folder1"}}
					rbacService := rbac.NewTestService(parityUserUID, permissions, folders)
					writeParityTuples(t, srv, ns, permissions, folders)

					t.Run("List", func(t *testing.T) {
						expected := normalizeParityList(parityListResult{All: grant.allowed})
						req := parityListReq(dashboardGroup, dashboardResource, "", utils.VerbCreate)
						rbacRes, err := rbacService.List(newContextWithNamespace(), parityWithNamespace(req, ns))
						require.NoError(t, err)
						require.Equal(t, expected, toParityListResult(rbacRes), "RBAC answer changed")
						zanzanaRes, err := srv.List(newContextWithNamespace(), parityWithNamespace(req, ns))
						require.NoError(t, err)
						assert.Equal(t, expected, toParityListResult(zanzanaRes), "Zanzana diverges from RBAC")
					})

					targets := []struct {
						name   string
						folder string
					}{
						{"root", ""},
						{"folder", "folder1"},
					}
					t.Run("Check", func(t *testing.T) {
						for _, target := range targets {
							t.Run(target.name, func(t *testing.T) {
								req := parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbCreate, "", target.folder)
								rbacRes, err := rbacService.Check(newContextWithNamespace(), parityWithNamespace(req, ns))
								require.NoError(t, err)
								require.Equal(t, grant.allowed, rbacRes.GetAllowed(), "RBAC answer changed")
								zanzanaRes, err := srv.Check(newContextWithNamespace(), parityWithNamespace(req, ns))
								require.NoError(t, err)
								assert.Equal(t, grant.allowed, zanzanaRes.GetAllowed(), "Zanzana diverges from RBAC")
							})
						}
					})

					t.Run("BatchCheck", func(t *testing.T) {
						req := &authzv1.BatchCheckRequest{Namespace: ns, Subject: paritySubject}
						for _, target := range targets {
							req.Checks = append(req.Checks, &authzv1.BatchCheckItem{
								CorrelationId: target.name,
								Group:         dashboardGroup,
								Resource:      dashboardResource,
								Verb:          utils.VerbCreate,
								Folder:        target.folder,
							})
						}
						rbacRes, err := rbacService.BatchCheck(newContextWithNamespace(), proto.Clone(req).(*authzv1.BatchCheckRequest))
						require.NoError(t, err)
						require.Len(t, rbacRes.GetResults(), len(targets))
						zanzanaRes, err := srv.BatchCheck(newContextWithNamespace(), proto.Clone(req).(*authzv1.BatchCheckRequest))
						require.NoError(t, err)
						require.Len(t, zanzanaRes.GetResults(), len(targets))
						for _, target := range targets {
							t.Run(target.name, func(t *testing.T) {
								require.Contains(t, rbacRes.GetResults(), target.name)
								require.Contains(t, zanzanaRes.GetResults(), target.name)
								rbacResult := rbacRes.GetResults()[target.name]
								zanzanaResult := zanzanaRes.GetResults()[target.name]
								require.Empty(t, rbacResult.GetError())
								require.Empty(t, zanzanaResult.GetError())
								require.Equal(t, grant.allowed, rbacResult.GetAllowed(), "RBAC answer changed")
								assert.Equal(t, grant.allowed, zanzanaResult.GetAllowed(), "Zanzana diverges from RBAC")
							})
						}
					})
				})
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Notebook creation parity
// ---------------------------------------------------------------------------

func TestIntegrationRBACParityNotebookCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	notebooks := dashv2beta1.NotebookResourceInfo.GroupResource()
	type creationGrant struct {
		action  string
		allowed bool
	}
	scopes := []struct {
		scope    string
		wildcard bool
	}{
		{"folders:uid:parent", false},
		{"folders:uid:*", true},
		{"notebooks:uid:*", true},
	}
	srv := setupOpenFGAServer(t)
	namespaceIndex := 0
	for _, scope := range scopes {
		t.Run(scope.scope, func(t *testing.T) {
			grants := []creationGrant{
				{"notebooks:view", false},
				{"notebooks:edit", false},
				{"notebooks:admin", false},
				{"notebooks:create", true},
			}
			if !scope.wildcard {
				grants = append(grants,
					creationGrant{"folders:view", false},
					creationGrant{"folders:edit", true},
					creationGrant{"folders:admin", true},
					creationGrant{"folders:create", false},
				)
			}
			for _, grant := range grants {
				t.Run(grant.action, func(t *testing.T) {
					ns := parityNamespace(namespaceIndex)
					namespaceIndex++
					permissions := []accesscontrol.Permission{{Action: grant.action, Scope: scope.scope}}
					folders := []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}, {UID: "unrelated"}}
					rbacService := rbac.NewTestService(parityUserUID, permissions, folders)
					writeParityTuples(t, srv, ns, permissions, folders)

					targets := []struct {
						name    string
						folder  string
						allowed bool
					}{
						{"parent", "parent", grant.allowed},
						{"child", "child", grant.allowed},
						{"unrelated", "unrelated", grant.allowed && scope.wildcard},
						{"root", "", grant.allowed && scope.wildcard},
					}
					t.Run("Check", func(t *testing.T) {
						for _, target := range targets {
							t.Run(target.name, func(t *testing.T) {
								req := parityCheckReq(notebooks.Group, notebooks.Resource, "", utils.VerbCreate, "", target.folder)
								rbacRes, err := rbacService.Check(newContextWithNamespace(), parityWithNamespace(req, ns))
								require.NoError(t, err)
								require.Equal(t, target.allowed, rbacRes.GetAllowed(), "RBAC answer changed")
								zanzanaRes, err := srv.Check(newContextWithNamespace(), parityWithNamespace(req, ns))
								require.NoError(t, err)
								assert.Equal(t, target.allowed, zanzanaRes.GetAllowed(), "Zanzana diverges from RBAC")
							})
						}
					})
					t.Run("List", func(t *testing.T) {
						expected := parityListResult{}
						if grant.allowed {
							if scope.wildcard {
								expected.All = true
							} else {
								expected.Folders = []string{"parent", "child"}
							}
						}
						req := parityListReq(notebooks.Group, notebooks.Resource, "", utils.VerbCreate)
						rbacRes, err := rbacService.List(newContextWithNamespace(), parityWithNamespace(req, ns))
						require.NoError(t, err)
						require.Equal(t, normalizeParityList(expected), toParityListResult(rbacRes), "RBAC answer changed")
						zanzanaRes, err := srv.List(newContextWithNamespace(), parityWithNamespace(req, ns))
						require.NoError(t, err)
						assert.Equal(t, normalizeParityList(expected), toParityListResult(zanzanaRes), "Zanzana diverges from RBAC")
					})
					t.Run("BatchCheck", func(t *testing.T) {
						req := &authzv1.BatchCheckRequest{Namespace: ns, Subject: paritySubject}
						for _, target := range targets {
							req.Checks = append(req.Checks, &authzv1.BatchCheckItem{
								CorrelationId: target.name,
								Group:         notebooks.Group,
								Resource:      notebooks.Resource,
								Verb:          utils.VerbCreate,
								Folder:        target.folder,
							})
						}
						rbacRes, err := rbacService.BatchCheck(newContextWithNamespace(), proto.Clone(req).(*authzv1.BatchCheckRequest))
						require.NoError(t, err)
						require.Len(t, rbacRes.GetResults(), len(targets))
						zanzanaRes, err := srv.BatchCheck(newContextWithNamespace(), proto.Clone(req).(*authzv1.BatchCheckRequest))
						require.NoError(t, err)
						require.Len(t, zanzanaRes.GetResults(), len(targets))
						for _, target := range targets {
							t.Run(target.name, func(t *testing.T) {
								require.Contains(t, rbacRes.GetResults(), target.name)
								require.Contains(t, zanzanaRes.GetResults(), target.name)
								rbacResult := rbacRes.GetResults()[target.name]
								zanzanaResult := zanzanaRes.GetResults()[target.name]
								require.Empty(t, rbacResult.GetError())
								require.Empty(t, zanzanaResult.GetError())
								require.Equal(t, target.allowed, rbacResult.GetAllowed(), "RBAC answer changed")
								assert.Equal(t, target.allowed, zanzanaResult.GetAllowed(), "Zanzana diverges from RBAC")
							})
						}
					})
				})
			}
		})
	}
}

// Generic creation requires explicit grants, including on subresources.
func TestIntegrationZanzanaCreatePolicy(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cases := []struct {
		resource    string
		subresource string
		relation    string
		allowed     bool
	}{
		{"variables", "", common.RelationSetEdit, false},
		{"variables", "", common.RelationSetAdmin, false},
		{"variables", "", common.RelationCreate, true},
		{"dashboards", "annotations", common.RelationSetEdit, false},
		{"dashboards", "annotations", common.RelationSetAdmin, false},
		{"dashboards", "annotations", common.RelationCreate, true},
	}
	for _, tc := range cases {
		for _, scope := range []string{"global", "folder", "resource"} {
			if scope == "resource" && tc.subresource == "" {
				continue // Creation of base resources is not scoped to an existing object.
			}
			t.Run(tc.resource+"/"+tc.subresource+"/"+tc.relation+"/"+scope, func(t *testing.T) {
				srv := setupOpenFGAServer(t)
				tuple := common.NewGroupResourceTuple(paritySubject, tc.relation, dashboardGroup, tc.resource, tc.subresource)
				expectedList := parityListResult{}
				switch scope {
				case "folder":
					tuple = common.NewFolderResourceTuple(paritySubject, tc.relation, dashboardGroup, tc.resource, tc.subresource, "parent")
					if tc.allowed {
						expectedList.Folders = []string{"parent", "child"}
					}
				case "resource":
					tuple = common.NewResourceTuple(paritySubject, tc.relation, dashboardGroup, tc.resource, tc.subresource, "target")
					if tc.allowed {
						expectedList.Items = []string{"target"}
					}
				default:
					expectedList.All = tc.allowed
				}
				setupOpenFGADatabase(t, srv, []*openfgav1.TupleKey{
					tuple,
					common.NewFolderParentTuple("child", "parent"),
				})

				t.Run("Check", func(t *testing.T) {
					req := parityCheckReq(dashboardGroup, tc.resource, tc.subresource, utils.VerbCreate, "target", "child")
					res, err := srv.Check(newContextWithNamespace(), parityWithNamespace(req, namespace))
					require.NoError(t, err)
					assert.Equal(t, tc.allowed, res.GetAllowed())
				})
				t.Run("List", func(t *testing.T) {
					req := parityListReq(dashboardGroup, tc.resource, tc.subresource, utils.VerbCreate)
					res, err := srv.List(newContextWithNamespace(), parityWithNamespace(req, namespace))
					require.NoError(t, err)
					assert.Equal(t, normalizeParityList(expectedList), toParityListResult(res))
				})
				t.Run("BatchCheck", func(t *testing.T) {
					res, err := srv.BatchCheck(newContextWithNamespace(), &authzv1.BatchCheckRequest{
						Namespace: namespace,
						Subject:   paritySubject,
						Checks: []*authzv1.BatchCheckItem{{
							CorrelationId: "create",
							Group:         dashboardGroup,
							Resource:      tc.resource,
							Subresource:   tc.subresource,
							Verb:          utils.VerbCreate,
							Name:          "target",
							Folder:        "child",
						}},
					})
					require.NoError(t, err)
					require.Len(t, res.GetResults(), 1)
					require.Contains(t, res.GetResults(), "create")
					result := res.GetResults()["create"]
					require.Empty(t, result.GetError())
					assert.Equal(t, tc.allowed, result.GetAllowed())
				})
			})
		}
	}
}

func TestIntegrationRBACParityWildcardFolderCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cases := []struct {
		name       string
		permission accesscontrol.Permission
		group      string
		resource   string
	}{
		{
			name:       "wildcard folder edit",
			permission: accesscontrol.Permission{Action: "folders:edit", Scope: "folders:uid:*"},
			group:      folderGroup,
			resource:   folderResource,
		},
		{
			name:       "wildcard folder admin",
			permission: accesscontrol.Permission{Action: "folders:admin", Scope: "folders:uid:*"},
			group:      folderGroup,
			resource:   folderResource,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := setupOpenFGAServer(t)
			tuples, ok := permissionToTuples(paritySubject, tc.permission)
			require.True(t, ok)
			setupOpenFGADatabase(t, srv, tuples)
			rbacService := rbac.NewTestService(parityUserUID, []accesscontrol.Permission{tc.permission}, nil)
			t.Run("Check", func(t *testing.T) {
				req := parityCheckReq(tc.group, tc.resource, "", utils.VerbCreate, "", "")
				rbacRes, err := rbacService.Check(newContextWithNamespace(), parityWithNamespace(req, namespace))
				require.NoError(t, err)
				require.True(t, rbacRes.GetAllowed())
				res, err := srv.Check(newContextWithNamespace(), parityWithNamespace(req, namespace))
				require.NoError(t, err)
				assert.True(t, res.GetAllowed())
			})
			t.Run("List", func(t *testing.T) {
				req := parityListReq(tc.group, tc.resource, "", utils.VerbCreate)
				expected := normalizeParityList(parityListResult{All: true})
				rbacRes, err := rbacService.List(newContextWithNamespace(), parityWithNamespace(req, namespace))
				require.NoError(t, err)
				require.Equal(t, expected, toParityListResult(rbacRes))
				res, err := srv.List(newContextWithNamespace(), parityWithNamespace(req, namespace))
				require.NoError(t, err)
				assert.Equal(t, expected, toParityListResult(res))
			})
			t.Run("BatchCheck", func(t *testing.T) {
				req := &authzv1.BatchCheckRequest{
					Namespace: namespace,
					Subject:   paritySubject,
					Checks: []*authzv1.BatchCheckItem{{
						CorrelationId: "create", Group: tc.group, Resource: tc.resource, Verb: utils.VerbCreate,
					}},
				}
				rbacRes, err := rbacService.BatchCheck(newContextWithNamespace(), proto.Clone(req).(*authzv1.BatchCheckRequest))
				require.NoError(t, err)
				res, err := srv.BatchCheck(newContextWithNamespace(), proto.Clone(req).(*authzv1.BatchCheckRequest))
				require.NoError(t, err)
				for engine, response := range map[string]*authzv1.BatchCheckResponse{"RBAC": rbacRes, "Zanzana": res} {
					require.Len(t, response.GetResults(), 1, engine)
					require.Contains(t, response.GetResults(), "create", engine)
					result := response.GetResults()["create"]
					require.Empty(t, result.GetError(), engine)
					assert.True(t, result.GetAllowed(), engine)
				}
			})
		})
	}
}

// Role write is not an Edit action set: it must not imply read or delete.
func TestIntegrationRBACParityRoleManagement(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, scope := range []struct {
		scope, kind, identifier string
	}{
		{"permissions:type:delegate", "permissions", "delegate"},
		{"roles:*", "roles", "*"},
	} {
		for _, permission := range []struct {
			action  string
			allowed map[string]bool
		}{
			{"roles:write", map[string]bool{utils.VerbCreate: true, utils.VerbUpdate: true, utils.VerbPatch: true}},
			{"roles:read", map[string]bool{utils.VerbGet: true, utils.VerbList: true, utils.VerbWatch: true}},
			{"roles:delete", map[string]bool{utils.VerbDelete: true, utils.VerbDeleteCollection: true}},
		} {
			t.Run(scope.scope+"/"+permission.action, func(t *testing.T) {
				srv := setupOpenFGAServer(t)
				setupOpenFGADatabase(t, srv, zanzana.RoleManagementToTuples(paritySubject, zanzana.RolePermission{
					Action: permission.action, Kind: scope.kind, Identifier: scope.identifier,
				}))
				rbacService := rbac.NewTestService(parityUserUID, []accesscontrol.Permission{{Action: permission.action, Scope: scope.scope}}, nil)
				batch := &authzv1.BatchCheckRequest{Namespace: namespace, Subject: paritySubject}
				for _, verb := range []string{utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch, utils.VerbGet, utils.VerbList, utils.VerbWatch, utils.VerbDelete, utils.VerbDeleteCollection} {
					t.Run(verb, func(t *testing.T) {
						allowed := permission.allowed[verb]
						for _, name := range []string{"", "role-1"} {
							t.Run("Check/"+name, func(t *testing.T) {
								req := parityCheckReq("iam.grafana.app", "roles", "", verb, name, "")
								rbacRes, err := rbacService.Check(newContextWithNamespace(), parityWithNamespace(req, namespace))
								require.NoError(t, err)
								require.Equal(t, allowed, rbacRes.GetAllowed(), "RBAC answer changed")
								res, err := srv.Check(newContextWithNamespace(), parityWithNamespace(req, namespace))
								require.NoError(t, err)
								assert.Equal(t, allowed, res.GetAllowed(), "Zanzana diverges from RBAC")
							})
							batch.Checks = append(batch.Checks, &authzv1.BatchCheckItem{
								CorrelationId: verb + "-" + name, Group: "iam.grafana.app", Resource: "roles", Verb: verb, Name: name,
							})
						}
						t.Run("List", func(t *testing.T) {
							req := parityListReq("iam.grafana.app", "roles", "", verb)
							expected := normalizeParityList(parityListResult{All: allowed})
							rbacRes, err := rbacService.List(newContextWithNamespace(), parityWithNamespace(req, namespace))
							require.NoError(t, err)
							require.Equal(t, expected, toParityListResult(rbacRes), "RBAC answer changed")
							res, err := srv.List(newContextWithNamespace(), parityWithNamespace(req, namespace))
							require.NoError(t, err)
							assert.Equal(t, expected, toParityListResult(res), "Zanzana diverges from RBAC")
						})
					})
				}
				t.Run("BatchCheck", func(t *testing.T) {
					rbacRes, err := rbacService.BatchCheck(newContextWithNamespace(), proto.Clone(batch).(*authzv1.BatchCheckRequest))
					require.NoError(t, err)
					res, err := srv.BatchCheck(newContextWithNamespace(), proto.Clone(batch).(*authzv1.BatchCheckRequest))
					require.NoError(t, err)
					for engine, response := range map[string]*authzv1.BatchCheckResponse{"RBAC": rbacRes, "Zanzana": res} {
						require.Len(t, response.GetResults(), len(batch.Checks), engine)
						for _, item := range batch.Checks {
							require.Contains(t, response.GetResults(), item.CorrelationId, engine)
							result := response.GetResults()[item.CorrelationId]
							require.Empty(t, result.GetError(), engine)
							assert.Equal(t, permission.allowed[item.Verb], result.GetAllowed(), "%s: %s", engine, item.CorrelationId)
						}
					}
				})
			})
		}
	}
}

// Edit allows reading/updating a service account, but only Admin allows deletion
// and permission management. Neither action set includes service-account creation.
// Use production writers so mismatches in tuple translation remain visible.
func TestIntegrationRBACParityServiceAccountPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	const (
		group    = "iam.grafana.app"
		resource = "serviceaccounts"
		uid      = "sa-target"
	)

	grants := []struct {
		action         string
		permissionVerb string
		allowed        map[string]bool
	}{
		{"serviceaccounts:edit", "Edit", map[string]bool{utils.VerbGet: true, utils.VerbList: true, utils.VerbWatch: true, utils.VerbUpdate: true, utils.VerbPatch: true}},
		{"serviceaccounts:admin", "Admin", map[string]bool{utils.VerbGet: true, utils.VerbList: true, utils.VerbWatch: true, utils.VerbUpdate: true, utils.VerbPatch: true, utils.VerbDelete: true, utils.VerbDeleteCollection: true, utils.VerbGetPermissions: true, utils.VerbSetPermissions: true}},
		{"serviceaccounts:read", "", map[string]bool{utils.VerbGet: true, utils.VerbList: true, utils.VerbWatch: true}},
		{"serviceaccounts:write", "", map[string]bool{utils.VerbUpdate: true, utils.VerbPatch: true}},
		{"serviceaccounts:delete", "", map[string]bool{utils.VerbDelete: true, utils.VerbDeleteCollection: true}},
		{"serviceaccounts.permissions:read", "", map[string]bool{utils.VerbGetPermissions: true}},
		{"serviceaccounts.permissions:write", "", map[string]bool{utils.VerbSetPermissions: true}},
		{"serviceaccounts:create", "", map[string]bool{utils.VerbCreate: true}},
		{"", "", map[string]bool{}},
	}
	for _, source := range []string{"role", "resource-permission"} {
		for _, scope := range []string{"serviceaccounts:uid:" + uid, "serviceaccounts:uid:*", ""} {
			for _, grant := range grants {
				unscoped := grant.action == "serviceaccounts:create" || grant.action == ""
				if unscoped != (scope == "") {
					continue
				}
				// ResourcePermission grants target an existing object, not a wildcard.
				if source == "resource-permission" && (grant.permissionVerb == "" || scope != "serviceaccounts:uid:"+uid) {
					continue
				}
				t.Run(source+"/"+grant.action+"/"+scope, func(t *testing.T) {
					permissions := []accesscontrol.Permission{}
					rolePermissions := []*authzextv1.RolePermission{}
					if grant.action != "" {
						permissions = append(permissions, accesscontrol.Permission{Action: grant.action, Scope: scope})
						rolePermissions = append(rolePermissions, &authzextv1.RolePermission{Action: grant.action, Scope: scope})
					}
					var tuples []*openfgav1.TupleKey
					var err error
					if source == "role" {
						tuples, err = zanzana.RoleToTuples("sa-permissions", rolePermissions)
						// Keep the binding even if the translator drops an unsupported action.
						tuples = append(tuples, common.NewTuple(paritySubject, common.RelationAssignee, "role:sa-permissions"))
					} else {
						tuples, err = zanzana.GetResourcePermissionWriteTuples(&authzextv1.CreatePermissionOperation{
							Resource:   &authzextv1.Resource{Group: group, Resource: resource, Name: uid},
							Permission: &authzextv1.Permission{Kind: "User", Name: parityUserUID, Verb: grant.permissionVerb},
						})
					}
					require.NoError(t, err)
					srv := setupOpenFGAServer(t)
					setupOpenFGADatabase(t, srv, tuples)
					rbacService := rbac.NewTestService(parityUserUID, permissions, nil)
					batch := &authzv1.BatchCheckRequest{Namespace: namespace, Subject: paritySubject}
					expectedBatch := map[string]bool{}
					for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbWatch, utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete, utils.VerbDeleteCollection, utils.VerbGetPermissions, utils.VerbSetPermissions, utils.VerbCreate} {
						t.Run(verb, func(t *testing.T) {
							names := []string{uid, "sa-other"}
							if verb == utils.VerbCreate {
								names = []string{""}
							}
							for _, name := range names {
								allowed := grant.allowed[verb] && (unscoped || scope == "serviceaccounts:uid:*" || name == uid)
								id := verb + "-" + name
								expectedBatch[id] = allowed
								batch.Checks = append(batch.Checks, &authzv1.BatchCheckItem{CorrelationId: id, Group: group, Resource: resource, Verb: verb, Name: name})
								t.Run("Check/"+name, func(t *testing.T) {
									req := parityCheckReq(group, resource, "", verb, name, "")
									rbacRes, err := rbacService.Check(newContextWithNamespace(), parityWithNamespace(req, namespace))
									require.NoError(t, err)
									require.Equal(t, allowed, rbacRes.GetAllowed(), "RBAC answer changed")
									res, err := srv.Check(newContextWithNamespace(), parityWithNamespace(req, namespace))
									require.NoError(t, err)
									assert.Equal(t, allowed, res.GetAllowed(), "Zanzana diverges from RBAC")
								})
							}
							t.Run("List", func(t *testing.T) {
								expected := parityListResult{}
								if grant.allowed[verb] {
									if unscoped {
										// RBAC List currently returns the empty scope as an item.
										expected.Items = []string{""}
									} else if scope == "serviceaccounts:uid:*" {
										expected.All = true
									} else {
										expected.Items = []string{uid}
									}
								}
								req := parityListReq(group, resource, "", verb)
								rbacRes, err := rbacService.List(newContextWithNamespace(), parityWithNamespace(req, namespace))
								require.NoError(t, err)
								require.Equal(t, normalizeParityList(expected), toParityListResult(rbacRes), "RBAC answer changed")
								res, err := srv.List(newContextWithNamespace(), parityWithNamespace(req, namespace))
								require.NoError(t, err)
								assert.Equal(t, normalizeParityList(expected), toParityListResult(res), "Zanzana diverges from RBAC")
							})
						})
					}
					t.Run("BatchCheck", func(t *testing.T) {
						rbacRes, err := rbacService.BatchCheck(newContextWithNamespace(), proto.Clone(batch).(*authzv1.BatchCheckRequest))
						require.NoError(t, err)
						res, err := srv.BatchCheck(newContextWithNamespace(), proto.Clone(batch).(*authzv1.BatchCheckRequest))
						require.NoError(t, err)
						for engine, response := range map[string]*authzv1.BatchCheckResponse{"RBAC": rbacRes, "Zanzana": res} {
							require.Len(t, response.GetResults(), len(expectedBatch), engine)
							for id, allowed := range expectedBatch {
								t.Run(engine+"/"+id, func(t *testing.T) {
									require.Contains(t, response.GetResults(), id)
									result := response.GetResults()[id]
									require.Empty(t, result.GetError())
									assert.Equal(t, allowed, result.GetAllowed())
								})
							}
						}
					})
				})
			}
		}
	}
}

// Exercise the production translators, not hand-built creation tuples. Both role
// permissions and ResourcePermission grants must survive a reconciliation.
func TestIntegrationRBACParityCreationGrants(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type creationCase struct {
		name, action, scope, group, resource, subresource, uid, folder string
		allowed                                                        bool
		list                                                           parityListResult
	}
	for _, kind := range []string{"role", "resource-permission"} {
		cases := []creationCase{
			{"folder edit", "folders:edit", "folders:uid:parent", folderGroup, folderResource, "", "", "child", true, parityListResult{Items: []string{"parent", "child"}}},
			{"folder admin", "folders:admin", "folders:uid:parent", folderGroup, folderResource, "", "", "child", true, parityListResult{Items: []string{"parent", "child"}}},
			{"folder view", "folders:view", "folders:uid:parent", folderGroup, folderResource, "", "", "child", false, parityListResult{}},
			{"unrelated folder", "folders:edit", "folders:uid:parent", folderGroup, folderResource, "", "", "unrelated", false, parityListResult{Items: []string{"parent", "child"}}},
			{"dashboard edit annotations", "dashboards:edit", "dashboards:uid:dash", dashboardGroup, dashboardResource, "annotations", "dash", "", true, parityListResult{Items: []string{"dash"}}},
			{"dashboard admin annotations", "dashboards:admin", "dashboards:uid:dash", dashboardGroup, dashboardResource, "annotations", "dash", "", true, parityListResult{Items: []string{"dash"}}},
			{"dashboard view annotations", "dashboards:view", "dashboards:uid:dash", dashboardGroup, dashboardResource, "annotations", "dash", "", false, parityListResult{}},
			{"unrelated dashboard", "dashboards:edit", "dashboards:uid:dash", dashboardGroup, dashboardResource, "annotations", "other", "", false, parityListResult{Items: []string{"dash"}}},
		}
		if kind == "role" {
			cases = append(cases,
				creationCase{"wildcard folder edit", "folders:edit", "folders:uid:*", folderGroup, folderResource, "", "", "", true, parityListResult{All: true}},
				creationCase{"wildcard folder admin", "folders:admin", "folders:uid:*", folderGroup, folderResource, "", "", "", true, parityListResult{All: true}},
				creationCase{"wildcard dashboard annotations", "dashboards:edit", "dashboards:uid:*", dashboardGroup, dashboardResource, "annotations", "dash", "", true, parityListResult{All: true}},
				creationCase{"folder scoped dashboard annotations", "dashboards:edit", "folders:uid:parent", dashboardGroup, dashboardResource, "annotations", "dash", "child", true, parityListResult{Folders: []string{"parent", "child"}}},
				creationCase{"folder scoped annotations unrelated", "dashboards:admin", "folders:uid:parent", dashboardGroup, dashboardResource, "annotations", "dash", "unrelated", false, parityListResult{Folders: []string{"parent", "child"}}},
			)
		}
		for _, tc := range cases {
			t.Run(kind+"/"+tc.name, func(t *testing.T) {
				srv := setupOpenFGAServer(t)
				var tuples []*openfgav1.TupleKey
				var err error
				permission := accesscontrol.Permission{Action: tc.action, Scope: tc.scope}
				if kind == "role" {
					tuples, err = zanzana.RoleToTuples("creation-grant", []*authzextv1.RolePermission{{Action: tc.action, Scope: tc.scope}})
					tuples = append(tuples, common.NewTuple(paritySubject, common.RelationAssignee, "role:creation-grant"))
				} else {
					_, _, uid := accesscontrol.SplitScope(tc.scope)
					_, verb, _ := strings.Cut(tc.action, ":")
					tuples, err = zanzana.GetResourcePermissionWriteTuples(&authzextv1.CreatePermissionOperation{
						Resource:   &authzextv1.Resource{Group: tc.group, Resource: tc.resource, Name: uid},
						Permission: &authzextv1.Permission{Kind: "User", Name: parityUserUID, Verb: verb},
					})
				}
				require.NoError(t, err)
				tuples = append(tuples, common.NewFolderParentTuple("child", "parent"))
				setupOpenFGADatabase(t, srv, tuples)
				rbacService := rbac.NewTestService(parityUserUID, []accesscontrol.Permission{permission}, []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: new("parent")}, {UID: "unrelated"}})
				t.Run("Check", func(t *testing.T) {
					req := parityCheckReq(tc.group, tc.resource, tc.subresource, utils.VerbCreate, tc.uid, tc.folder)
					rbacRes, err := rbacService.Check(newContextWithNamespace(), parityWithNamespace(req, namespace))
					require.NoError(t, err)
					require.Equal(t, tc.allowed, rbacRes.GetAllowed(), "RBAC answer changed")
					res, err := srv.Check(newContextWithNamespace(), parityWithNamespace(req, namespace))
					require.NoError(t, err)
					assert.Equal(t, tc.allowed, res.GetAllowed())
				})
				t.Run("List", func(t *testing.T) {
					req := parityListReq(tc.group, tc.resource, tc.subresource, utils.VerbCreate)
					expected := normalizeParityList(tc.list)
					rbacRes, err := rbacService.List(newContextWithNamespace(), parityWithNamespace(req, namespace))
					require.NoError(t, err)
					require.Equal(t, expected, toParityListResult(rbacRes), "RBAC answer changed")
					res, err := srv.List(newContextWithNamespace(), parityWithNamespace(req, namespace))
					require.NoError(t, err)
					assert.Equal(t, expected, toParityListResult(res))
				})
				t.Run("BatchCheck", func(t *testing.T) {
					req := &authzv1.BatchCheckRequest{Namespace: namespace, Subject: paritySubject, Checks: []*authzv1.BatchCheckItem{{CorrelationId: "create", Group: tc.group, Resource: tc.resource, Subresource: tc.subresource, Verb: utils.VerbCreate, Name: tc.uid, Folder: tc.folder}}}
					rbacRes, err := rbacService.BatchCheck(newContextWithNamespace(), proto.Clone(req).(*authzv1.BatchCheckRequest))
					require.NoError(t, err)
					res, err := srv.BatchCheck(newContextWithNamespace(), req)
					require.NoError(t, err)
					for engine, response := range map[string]*authzv1.BatchCheckResponse{"RBAC": rbacRes, "Zanzana": res} {
						require.Contains(t, response.GetResults(), "create", engine)
						result := response.GetResults()["create"]
						require.Empty(t, result.GetError(), engine)
						assert.Equal(t, tc.allowed, result.GetAllowed(), engine)
					}
				})
			})
		}
	}
}

// Datasource Query/Edit/Admin already write an explicit /query creation grant;
// the stricter model must preserve it without granting access to other datasources.
func TestIntegrationZanzanaDatasourceQueryCreation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	const group = "loki.datasource.grafana.app"
	for _, verb := range []string{"Query", "Edit", "Admin", "get"} {
		t.Run(verb, func(t *testing.T) {
			srv := setupOpenFGAServer(t)
			tuples, err := zanzana.GetResourcePermissionWriteTuples(&authzextv1.CreatePermissionOperation{
				Resource:   &authzextv1.Resource{Group: group, Resource: "datasources", Name: "ds-1"},
				Permission: &authzextv1.Permission{Kind: "User", Name: parityUserUID, Verb: verb},
			})
			require.NoError(t, err)
			setupOpenFGADatabase(t, srv, tuples)
			for _, uid := range []string{"ds-1", "ds-other"} {
				allowed := verb != "get" && uid == "ds-1"
				t.Run("Check/"+uid, func(t *testing.T) {
					req := parityCheckReq(group, "datasources", "query", utils.VerbCreate, uid, "")
					res, err := srv.Check(newContextWithNamespace(), parityWithNamespace(req, namespace))
					require.NoError(t, err)
					assert.Equal(t, allowed, res.GetAllowed())
				})
				t.Run("BatchCheck/"+uid, func(t *testing.T) {
					res, err := srv.BatchCheck(newContextWithNamespace(), &authzv1.BatchCheckRequest{
						Namespace: namespace, Subject: paritySubject,
						Checks: []*authzv1.BatchCheckItem{{CorrelationId: "query", Group: group, Resource: "datasources", Subresource: "query", Verb: utils.VerbCreate, Name: uid}},
					})
					require.NoError(t, err)
					require.Contains(t, res.GetResults(), "query")
					result := res.GetResults()["query"]
					require.Empty(t, result.GetError())
					assert.Equal(t, allowed, result.GetAllowed())
				})
			}
			t.Run("List", func(t *testing.T) {
				req := parityListReq(group, "datasources", "query", utils.VerbCreate)
				res, err := srv.List(newContextWithNamespace(), parityWithNamespace(req, namespace))
				require.NoError(t, err)
				expected := parityListResult{}
				if verb != "get" {
					expected.Items = []string{"ds-1"}
				}
				assert.Equal(t, normalizeParityList(expected), toParityListResult(res))
			})
		})
	}
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

// compareEngines enforces the cases where the engines agree today and reports
// the ones where they do not. See the file header for why open gaps are
// reported rather than failed.
func compareEngines[T any](t *testing.T, gaps *parityGaps, name string, expected T, zanzanaToday *T, divergence string, gotZanzana, gotRBAC T) {
	t.Helper()

	if zanzanaToday == nil {
		assert.Equal(t, expected, gotZanzana,
			"enforced case: zanzana diverges from RBAC (RBAC=%v). Either fix the divergence or, if it is "+
				"intended, record it as an open gap with a divergence note.", gotRBAC)
		return
	}

	switch {
	case assert.ObjectsAreEqual(gotZanzana, gotRBAC):
		t.Logf("RESOLVED: zanzana now agrees with RBAC. Delete zanzanaToday and divergence to enforce "+
			"this case.\n  was: %s", divergence)
		gaps.resolved = append(gaps.resolved, name)

	case assert.ObjectsAreEqual(gotZanzana, *zanzanaToday):
		t.Logf("OPEN GAP: rbac=%v zanzana=%v\n  %s", gotRBAC, gotZanzana, divergence)
		gaps.open = append(gaps.open, fmt.Sprintf("%s (rbac=%v zanzana=%v)", name, gotRBAC, gotZanzana))

	default:
		t.Logf("GAP MOVED: zanzana answers %v, which is neither RBAC's %v nor the recorded %v. Update "+
			"zanzanaToday.\n  %s", gotZanzana, gotRBAC, *zanzanaToday, divergence)
		gaps.moved = append(gaps.moved, fmt.Sprintf("%s (rbac=%v zanzana=%v recorded=%v)",
			name, gotRBAC, gotZanzana, *zanzanaToday))
	}
}

// parityGaps collects the open-gap cases so the parent test can print an
// inventory once every case has run. Subtests here are sequential, so no lock.
type parityGaps struct {
	open     []string
	resolved []string
	moved    []string
}

// report prints the inventory. Run with -v to see it on a green build.
func (g *parityGaps) report(t *testing.T, total int) {
	t.Helper()

	enforced := total - len(g.open) - len(g.resolved) - len(g.moved)
	t.Logf("parity: %d/%d cases enforced, %d open gaps, %d resolved, %d moved",
		enforced, total, len(g.open), len(g.resolved), len(g.moved))
	for _, name := range g.open {
		t.Logf("  open gap: %s", name)
	}
	for _, name := range g.resolved {
		t.Logf("  resolved: %s -- delete zanzanaToday/divergence to enforce it", name)
	}
	for _, name := range g.moved {
		t.Logf("  moved:    %s", name)
	}
}

// parityNamespace gives every case its own namespace. Zanzana keys its OpenFGA
// store by namespace, so this is what keeps one case's tuples out of the next.
// The RBAC service is rebuilt per case, so it needs no such isolation.
func parityNamespace(i int) string {
	return fmt.Sprintf("org-%d", i+2)
}

func writeParityTuples(t *testing.T, srv *Server, ns string, permissions []accesscontrol.Permission, folders []rbacstore.Folder) {
	t.Helper()

	tuples := make([]*openfgav1.TupleKey, 0, len(permissions)+len(folders))
	for _, f := range folders {
		if f.ParentUID != nil {
			tuples = append(tuples, common.NewFolderParentTuple(f.UID, *f.ParentUID))
		}
	}
	for _, p := range permissions {
		translated, ok := permissionToTuples(paritySubject, p)
		if !ok {
			// Zanzana has no translation for this action. That is itself a
			// divergence, and the case's expectation records it.
			continue
		}
		tuples = append(tuples, translated...)
	}
	if len(tuples) == 0 {
		return
	}

	ctx := context.Background()
	storeInf, err := srv.getStoreInfo(ctx, ns)
	require.NoError(t, err)

	_, err = srv.openFGAClient.Write(ctx, &openfgav1.WriteRequest{
		StoreId:              storeInf.ID,
		AuthorizationModelId: storeInf.ModelID,
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys:   tuples,
			OnDuplicate: "ignore",
		},
	})
	require.NoError(t, err)
}

// permissionToTuples mirrors what the reconciler does when it syncs RBAC rows
// into Zanzana: split the scope into kind + identifier and hand both to the
// shared translation table.
func permissionToTuples(subject string, perm accesscontrol.Permission) ([]*openfgav1.TupleKey, bool) {
	kind, identifier := perm.Kind, perm.Identifier
	if kind == "" && perm.Scope != "" {
		kind, _, identifier = accesscontrol.SplitScope(perm.Scope)
	}

	// Grants with no scope (stack roles) or a bare "*" carry no kind, so recover
	// it from the action. Ordering matters: the folders table also maps the
	// dashboard/notebook actions, and for an unscoped grant the resource's own
	// table is the right one.
	if kind == "" || kind == "*" {
		for _, candidate := range []string{
			common.KindDashboards,
			common.KindNotebooks,
			common.KindTeams,
			common.KindUsers,
			common.KindFolders,
		} {
			if tuple, ok := common.TranslateToResourceTuples(subject, perm.Action, candidate, "*"); ok {
				return tuple, true
			}
		}
		return nil, false
	}

	if identifier == "" {
		identifier = "*"
	}
	return common.TranslateToResourceTuples(subject, perm.Action, kind, identifier)
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

func parityCheckReq(group, resource, subresource, verb, name, folder string) *authzv1.CheckRequest {
	return &authzv1.CheckRequest{
		Subject:     paritySubject,
		Group:       group,
		Resource:    resource,
		Subresource: subresource,
		Verb:        verb,
		Name:        name,
		Folder:      folder,
	}
}

func parityListReq(group, resource, subresource, verb string) *authzv1.ListRequest {
	return &authzv1.ListRequest{
		Subject:     paritySubject,
		Group:       group,
		Resource:    resource,
		Subresource: subresource,
		Verb:        verb,
	}
}

// parityWithNamespace copies the request so the two engines cannot observe each
// other's mutations (the RBAC check path rewrites the parent folder in place).
func parityWithNamespace[T proto.Message](req T, ns string) T {
	out := proto.Clone(req).(T)
	switch r := any(out).(type) {
	case *authzv1.CheckRequest:
		r.Namespace = ns
	case *authzv1.ListRequest:
		r.Namespace = ns
	}
	return out
}

func toParityListResult(res *authzv1.ListResponse) parityListResult {
	return normalizeParityList(parityListResult{
		All:     res.GetAll(),
		Items:   res.GetItems(),
		Folders: res.GetFolders(),
	})
}

func normalizeParityList(l parityListResult) parityListResult {
	out := parityListResult{
		All:     l.All,
		Items:   append([]string{}, l.Items...),
		Folders: append([]string{}, l.Folders...),
	}
	sort.Strings(out.Items)
	sort.Strings(out.Folders)
	return out
}

func normalizeParityListPtr(l *parityListResult) *parityListResult {
	if l == nil {
		return nil
	}
	out := normalizeParityList(*l)
	return &out
}
