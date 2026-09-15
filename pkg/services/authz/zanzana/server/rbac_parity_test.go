package server

// Parity harness: one RBAC grant fixture is fed to both authorization engines
// and the two answers are compared.
//
//	permissions ([]accesscontrol.Permission) + folder tree
//	   ├─► RBAC:    rbac.NewTestService -> Service.Check / Service.List
//	   └─► Zanzana: common.TranslateToResourceTuple -> OpenFGA tuples -> Server.Check / Server.List
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
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	rbacstore "github.com/grafana/grafana/pkg/services/authz/rbac/store"
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
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: parityStrPtr("parent")}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", "child"),
			expected:    true,
		},
		{
			name:        "dashboard get does not inherit up the folder tree",
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "folders:uid:child"}},
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: parityStrPtr("parent")}},
			req:         parityCheckReq(dashboardGroup, dashboardResource, "", utils.VerbGet, "dash1", "parent"),
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
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: parityStrPtr("parent")}},
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
			name:         "variable get at the root maps the empty parent to general",
			permissions:  []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:general"}},
			req:          parityCheckReq(dashboardGroup, "variables", "", utils.VerbGet, "region", ""),
			expected:     true,
			zanzanaToday: parityBoolPtr(false),
			divergence: "RBAC maps an empty parent to general for variables on every verb, because variables " +
				"persist with an empty folder annotation while grants use folders:uid:general. Zanzana applies " +
				"the empty-to-general default on create only, so a root variable read falls through to a " +
				"direct object check and is denied.",
		},
		{
			name:         "variable update at the root maps the empty parent to general",
			permissions:  []accesscontrol.Permission{{Action: "folders:edit", Scope: "folders:uid:general"}},
			req:          parityCheckReq(dashboardGroup, "variables", "", utils.VerbUpdate, "region", ""),
			expected:     true,
			zanzanaToday: parityBoolPtr(false),
			divergence: "Same empty-parent handling as the get case above: RBAC rewrites the parent to general " +
				"for variables on every verb, Zanzana only on create.",
		},

		// -- subresources ----------------------------------------------------
		{
			name:         "dashboard annotation get via the dashboard-scoped annotation action",
			permissions:  []accesscontrol.Permission{{Action: "annotations:read", Scope: "dashboards:uid:dash1"}},
			req:          parityCheckReq(dashboardGroup, dashboardResource, "annotations", utils.VerbGet, "dash1", ""),
			expected:     true,
			zanzanaToday: parityBoolPtr(false),
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
			zanzanaToday: parityBoolPtr(false),
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
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: parityStrPtr("parent")}},
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
			folders:     []rbacstore.Folder{{UID: "parent"}, {UID: "child", ParentUID: parityStrPtr("parent")}},
			req:         parityListReq(folderGroup, folderResource, "", utils.VerbGet),
			expected:    parityListResult{Items: []string{"parent", "child"}},
		},
		{
			name:         "variables with a grant on general",
			permissions:  []accesscontrol.Permission{{Action: "folders:view", Scope: "folders:uid:general"}},
			req:          parityListReq(dashboardGroup, "variables", "", utils.VerbList),
			expected:     parityListResult{Folders: []string{"general", ""}},
			zanzanaToday: &parityListResult{Folders: []string{"general"}},
			divergence: "RBAC aliases the root folder sentinels for variables, returning both general and the " +
				"empty string so variables persisted with an empty folder annotation match. Zanzana returns " +
				"only the folder UIDs it holds tuples for.",
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
		tuple, ok := permissionToTuple(paritySubject, p)
		if !ok {
			// Zanzana has no translation for this action. That is itself a
			// divergence, and the case's expectation records it.
			continue
		}
		tuples = append(tuples, tuple)
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

// permissionToTuple mirrors what the reconciler does when it syncs RBAC rows
// into Zanzana: split the scope into kind + identifier and hand both to the
// shared translation table.
func permissionToTuple(subject string, perm accesscontrol.Permission) (*openfgav1.TupleKey, bool) {
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
			if tuple, ok := common.TranslateToResourceTuple(subject, perm.Action, candidate, "*"); ok {
				return tuple, true
			}
		}
		return nil, false
	}

	if identifier == "" {
		identifier = "*"
	}
	return common.TranslateToResourceTuple(subject, perm.Action, kind, identifier)
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

func parityStrPtr(s string) *string { return &s }

func parityBoolPtr(b bool) *bool { return &b }
