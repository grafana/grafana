package team

// Storage-layer parity test for the public legacy team APIs across dual-write
// Modes 0/1/5. The companion to pkg/services/team/parity (the live shadow
// comparator) — same contract, two execution surfaces.
//
// For each mode, with kubernetesTeamsRedirect ON, this test:
//
//  1. Performs a write through the public legacy HTTP API (POST /api/teams,
//     PUT, DELETE, member add/remove).
//  2. Reads the resulting state back from BOTH the legacy SQL store (direct
//     query via helper.GetEnv().SQLStore) AND the K8s API (direct dynamic
//     client read).
//  3. Asserts the per-mode invariant.
//
// Known limitation in Mode 1: the K8s dynamic client always goes through the
// K8s API server's dual-writer, which in Mode 1 reads from legacy SQL. So a
// "K8s direct read" in Mode 1 effectively returns the legacy view via the
// K8s adapter — useful for catching adapter-mapping bugs (A/B/C/D from the
// bug bash) but NOT able to directly observe whether the dual-writer's
// best-effort write to unified storage actually happened. Verifying that
// would need a side channel below the dual-writer (gRPC to the unified
// store, or a debug endpoint). Out of scope for v0.
//
// Run a single mode:
//
//	go test -timeout 180s -run 'TestIntegrationLegacyTeamAPIParity/mode-1' \
//	  ./pkg/tests/apis/iam/team -count=1 -v

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	apiserverrest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// teamFromSQL is the slim view of the legacy `team` row that the parity check
// uses. Only fields that should round-trip through both adapters.
type teamFromSQL struct {
	ID            int64
	UID           string
	OrgID         int64
	Name          string
	Email         string
	ExternalUID   string
	IsProvisioned bool
}

// teamFromK8s is the view of the K8s Team object built from the dynamic
// client response. Fields chosen to align 1:1 with teamFromSQL.
type teamFromK8s struct {
	UID           string // = metadata.name
	Title         string // = spec.title (corresponds to legacy Name)
	Email         string // = spec.email
	ExternalUID   string // = spec.externalUID
	IsProvisioned bool   // = spec.provisioned
}

// teamLegacyHTTPResponse is the rich view returned by GET /api/teams/{id},
// including MemberCount so the parity test can also surface Bug B.
type teamLegacyHTTPResponse struct {
	ID            int64  `json:"id"`
	UID           string `json:"uid"`
	OrgID         int64  `json:"orgId"`
	Name          string `json:"name"`
	Email         string `json:"email"`
	ExternalUID   string `json:"externalUID"`
	IsProvisioned bool   `json:"isProvisioned"`
	MemberCount   int64  `json:"memberCount"`
}

// userTeamItem is one row in the /api/user/teams response.
type userTeamItem struct {
	ID   int64  `json:"id"`
	UID  string `json:"uid"`
	Name string `json:"name"`
}

// go test -timeout 300s -run ^TestIntegrationLegacyTeamAPIParity$ github.com/grafana/grafana/pkg/tests/apis/iam/team -count=1
func TestIntegrationLegacyTeamAPIParity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []apiserverrest.DualWriterMode{
		apiserverrest.Mode0,
		apiserverrest.Mode1,
		apiserverrest.Mode5,
	}

	for _, mode := range modes {
		t.Run(fmt.Sprintf("mode-%d", mode), func(t *testing.T) {
			helper := newParityHelper(t, mode)
			t.Cleanup(helper.Shutdown)

			enableTeamK8sRedirect(t, true)
			t.Cleanup(func() { enableTeamK8sRedirect(t, false) })

			t.Run("CRUD parity: write via legacy HTTP, both stores reflect", func(t *testing.T) {
				assertCRUDParity(t, helper, mode)
			})
			t.Run("Members parity: add/remove via legacy HTTP, both stores reflect", func(t *testing.T) {
				assertMembersParity(t, helper, mode)
			})
			t.Run("BugA: search returns non-zero legacy ID", func(t *testing.T) {
				assertSearchReturnsNonZeroID(t, helper)
			})
			t.Run("BugB: get returns accurate memberCount", func(t *testing.T) {
				assertMemberCountAccurate(t, helper)
			})
			t.Run("BugC: duplicate name returns 409", func(t *testing.T) {
				assertDuplicateNameReturns409(t, helper)
			})
			t.Run("BugD: non-admin can read /api/user/teams", func(t *testing.T) {
				assertNonAdminCanReadUserTeams(t, helper)
			})
		})
	}
}

// --- helpers ---------------------------------------------------------------

func newParityHelper(t *testing.T, mode apiserverrest.DualWriterMode) *apis.K8sTestHelper {
	t.Helper()
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:      false,
		DisableAnonymous:       true,
		RBACSingleOrganization: true,
		APIServerStorageType:   "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"teams.iam.grafana.app": {DualWriterMode: mode},
		},
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagKubernetesTeamsApi,
			featuremgmt.FlagKubernetesTeamsRedirect,
			featuremgmt.FlagKubernetesUsersApi,
		},
	})
}

// enableTeamK8sRedirect is the local copy of setTeamK8sFeatureToggle. The
// canonical version lives in team_redirect_integration_test.go but we
// duplicate the flag-flipping logic here to keep this file self-contained.
func enableTeamK8sRedirect(t *testing.T, enabled bool) {
	t.Helper()
	provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagKubernetesTeamsApi: {
			Key:            featuremgmt.FlagKubernetesTeamsApi,
			DefaultVariant: "default",
			Variants:       map[string]any{"default": enabled},
		},
		featuremgmt.FlagKubernetesTeamsRedirect: {
			Key:            featuremgmt.FlagKubernetesTeamsRedirect,
			DefaultVariant: "default",
			Variants:       map[string]any{"default": enabled},
		},
	})
	require.NoError(t, openfeature.SetProviderAndWait(provider))
}

// readTeamFromSQL hits the legacy `team` row directly. This is the source
// of truth for "what's in legacy storage" — bypasses every adapter, every
// dual-writer mode logic, and every K8s machinery.
func readTeamFromSQL(t *testing.T, helper *apis.K8sTestHelper, teamID int64) (teamFromSQL, bool) {
	t.Helper()
	var out teamFromSQL
	found := false
	err := helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		var rows []struct {
			ID            int64  `xorm:"id"`
			UID           string `xorm:"uid"`
			OrgID         int64  `xorm:"org_id"`
			Name          string `xorm:"name"`
			Email         string `xorm:"email"`
			ExternalUID   string `xorm:"external_uid"`
			IsProvisioned bool   `xorm:"is_provisioned"`
		}
		if err := sess.SQL(
			"SELECT id, uid, org_id, name, email, external_uid, is_provisioned FROM team WHERE id = ?",
			teamID,
		).Find(&rows); err != nil {
			return err
		}
		if len(rows) == 1 {
			out = teamFromSQL{
				ID:            rows[0].ID,
				UID:           rows[0].UID,
				OrgID:         rows[0].OrgID,
				Name:          rows[0].Name,
				Email:         rows[0].Email,
				ExternalUID:   rows[0].ExternalUID,
				IsProvisioned: rows[0].IsProvisioned,
			}
			found = true
		}
		return nil
	})
	require.NoError(t, err)
	return out, found
}

// readTeamFromK8s reads the Team via the K8s dynamic client. In Mode 0/1
// this transitively returns the legacy view (because the dual-writer reads
// from legacy in those modes); in Mode 5 it returns the unified view.
// Either way, this is what an external K8s API client sees.
func readTeamFromK8s(t *testing.T, helper *apis.K8sTestHelper, teamUID string) (teamFromK8s, bool) {
	t.Helper()
	teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
		GVR:       gvrTeams,
	})
	obj, err := teamClient.Resource.Get(context.Background(), teamUID, metav1.GetOptions{})
	if err != nil {
		// Best-effort distinguish 404 from other errors. The dynamic client's
		// errors aren't easy to typify here, so fall back to treating any
		// error as "not found" — callers always pair this with require/assert
		// statements that contextualize what they expected.
		return teamFromK8s{}, false
	}
	spec, _ := obj.Object["spec"].(map[string]any)
	provisioned, _ := spec["provisioned"].(bool)
	externalUID, _ := spec["externalUID"].(string)
	title, _ := spec["title"].(string)
	email, _ := spec["email"].(string)
	return teamFromK8s{
		UID:           obj.GetName(),
		Title:         title,
		Email:         email,
		ExternalUID:   externalUID,
		IsProvisioned: provisioned,
	}, true
}

func assertTeamFieldsMatch(t *testing.T, sqlT teamFromSQL, k8sT teamFromK8s) {
	t.Helper()
	assert.Equal(t, sqlT.UID, k8sT.UID, "UID must round-trip identically between stores")
	assert.Equal(t, sqlT.Name, k8sT.Title, "legacy.name must equal K8s spec.title")
	assert.Equal(t, sqlT.Email, k8sT.Email, "email must match")
	assert.Equal(t, sqlT.ExternalUID, k8sT.ExternalUID, "externalUID must match")
	assert.Equal(t, sqlT.IsProvisioned, k8sT.IsProvisioned, "isProvisioned must match")
}

// --- per-mode parity invariants -------------------------------------------

func assertCRUDParity(t *testing.T, helper *apis.K8sTestHelper, mode apiserverrest.DualWriterMode) {
	t.Helper()

	teamID, teamUID := createTeamViaAPI(t, helper, fmt.Sprintf("parity-crud-%d", mode), fmt.Sprintf("parity-crud-%d@example.com", mode))
	t.Cleanup(func() { deleteTeamViaAPI(t, helper, teamID) })

	// Always observable: K8s view of the team. The dual-writer in any mode
	// serves a read through the K8s API.
	k8sTeam, k8sFound := readTeamFromK8s(t, helper, teamUID)
	require.True(t, k8sFound, "after legacy HTTP create, K8s view of team %q must exist", teamUID)

	// Mode-specific legacy SQL invariant.
	sqlTeam, sqlFound := readTeamFromSQL(t, helper, teamID)
	switch mode {
	case apiserverrest.Mode0, apiserverrest.Mode1:
		require.True(t, sqlFound, "Mode %d: legacy SQL row must exist after write", mode)
		assertTeamFieldsMatch(t, sqlTeam, k8sTeam)
	case apiserverrest.Mode5:
		// Mode 5 reads/writes from unified only. Whether legacy SQL still
		// gets a row depends on the dual-writer's Mode 5 fanout behavior;
		// in pure unified-only operation it does not. We DON'T require SQL
		// state here — the assertion to make in Mode 5 is that the K8s view
		// is correct, full stop.
		_ = sqlTeam
	default:
		t.Fatalf("unhandled mode %d", mode)
	}

	// Update path.
	newName := fmt.Sprintf("parity-crud-%d-renamed", mode)
	newEmail := fmt.Sprintf("parity-crud-%d-renamed@example.com", mode)
	updateTeamViaAPI(t, helper, teamID, newName, newEmail)

	k8sAfter, k8sFoundAfter := readTeamFromK8s(t, helper, teamUID)
	require.True(t, k8sFoundAfter, "after legacy HTTP update, K8s view of team must still exist")
	assert.Equal(t, newName, k8sAfter.Title, "Mode %d: K8s view must reflect renamed team", mode)
	assert.Equal(t, newEmail, k8sAfter.Email, "Mode %d: K8s view must reflect updated email", mode)

	if mode == apiserverrest.Mode0 || mode == apiserverrest.Mode1 {
		sqlAfter, ok := readTeamFromSQL(t, helper, teamID)
		require.True(t, ok)
		assert.Equal(t, newName, sqlAfter.Name, "Mode %d: legacy SQL name must reflect rename", mode)
		assert.Equal(t, newEmail, sqlAfter.Email, "Mode %d: legacy SQL email must reflect update", mode)
	}
}

func assertMembersParity(t *testing.T, helper *apis.K8sTestHelper, mode apiserverrest.DualWriterMode) {
	t.Helper()

	teamID, _ := createTeamViaAPI(t, helper, fmt.Sprintf("parity-members-%d", mode), fmt.Sprintf("members-%d@example.com", mode))
	t.Cleanup(func() { deleteTeamViaAPI(t, helper, teamID) })

	editorID, err := helper.Org1.Editor.Identity.GetInternalID()
	require.NoError(t, err)

	addTeamMemberViaAPI(t, helper, teamID, editorID)

	// Observable via the legacy /members endpoint regardless of mode (the
	// endpoint routes through the same K8s adapter when redirect is on).
	//
	// Expected count is 2, not 1: POST /api/teams auto-adds the creator
	// (helper.Org1.Admin in this test) as a team Admin (permission=4). So
	// after explicitly adding the editor, members = {creator-admin, editor}.
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/teams/%d/members", teamID),
	}, &[]map[string]any{})
	require.Equal(t, http.StatusOK, resp.Response.StatusCode, "body=%s", string(resp.Body))
	require.Len(t, *resp.Result, 2, "Mode %d: two members after add (creator-admin + editor)", mode)
	editorPresent := false
	for _, member := range *resp.Result {
		if userID, ok := member["userId"].(float64); ok && int64(userID) == editorID {
			editorPresent = true
			break
		}
	}
	assert.True(t, editorPresent, "Mode %d: editor (userID=%d) must appear in /members response after add", mode, editorID)

	// Mode 0/1 invariant: the legacy team_member row exists.
	if mode == apiserverrest.Mode0 || mode == apiserverrest.Mode1 {
		var count int64
		err := helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			var rows []struct {
				N int64 `xorm:"n"`
			}
			if err := sess.SQL(
				"SELECT COUNT(*) AS n FROM team_member WHERE team_id = ? AND user_id = ?",
				teamID, editorID,
			).Find(&rows); err != nil {
				return err
			}
			if len(rows) > 0 {
				count = rows[0].N
			}
			return nil
		})
		require.NoError(t, err)
		assert.EqualValues(t, 1, count, "Mode %d: legacy team_member row must exist after add-member through legacy HTTP", mode)
	}
}

// --- bug-bash regression coverage ------------------------------------------

func assertSearchReturnsNonZeroID(t *testing.T, helper *apis.K8sTestHelper) {
	t.Helper()
	teamID, _ := createTeamViaAPI(t, helper, "parity-buga", "buga@example.com")
	t.Cleanup(func() { deleteTeamViaAPI(t, helper, teamID) })

	res := searchTeamsViaAPI(t, helper, url.Values{"query": {"parity-buga"}})
	require.GreaterOrEqual(t, len(res.Teams), 1)
	for _, found := range res.Teams {
		assert.NotZero(t, found.ID, "Bug A: search returned a team with id=0 (uid=%s)", found.UID)
	}
}

func assertMemberCountAccurate(t *testing.T, helper *apis.K8sTestHelper) {
	t.Helper()
	teamID, _ := createTeamViaAPI(t, helper, "parity-bugb", "bugb@example.com")
	t.Cleanup(func() { deleteTeamViaAPI(t, helper, teamID) })

	editorID, err := helper.Org1.Editor.Identity.GetInternalID()
	require.NoError(t, err)
	// POST /api/teams auto-adds the creator (helper.Org1.Admin) as a team
	// Admin, so we only need to add the editor to reach a 2-member state.
	addTeamMemberViaAPI(t, helper, teamID, editorID)

	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/teams/%d", teamID),
	}, &teamLegacyHTTPResponse{})
	require.Equal(t, http.StatusOK, resp.Response.StatusCode, "body=%s", string(resp.Body))
	assert.EqualValues(t, 2, resp.Result.MemberCount,
		"Bug B: GET /api/teams/%d returned memberCount=%d (expected 2: creator-admin + editor)", teamID, resp.Result.MemberCount)
}

func assertDuplicateNameReturns409(t *testing.T, helper *apis.K8sTestHelper) {
	t.Helper()
	name := "parity-bugc"
	teamID, _ := createTeamViaAPI(t, helper, name, "bugc@example.com")
	t.Cleanup(func() { deleteTeamViaAPI(t, helper, teamID) })

	body, err := json.Marshal(map[string]string{"name": name, "email": "bugc-dup@example.com"})
	require.NoError(t, err)
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPost,
		Path:   "/api/teams",
		Body:   body,
	}, &struct{}{})
	assert.Equal(t, http.StatusConflict, resp.Response.StatusCode,
		"Bug C: duplicate POST /api/teams must be 409 Conflict; body=%s", string(resp.Body))
}

func assertNonAdminCanReadUserTeams(t *testing.T, helper *apis.K8sTestHelper) {
	t.Helper()
	teamID, _ := createTeamViaAPI(t, helper, "parity-bugd", "bugd@example.com")
	t.Cleanup(func() { deleteTeamViaAPI(t, helper, teamID) })

	viewerID, err := helper.Org1.Viewer.Identity.GetInternalID()
	require.NoError(t, err)
	addTeamMemberViaAPI(t, helper, teamID, viewerID)

	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Viewer,
		Method: http.MethodGet,
		Path:   "/api/user/teams",
	}, &[]userTeamItem{})
	assert.Equal(t, http.StatusOK, resp.Response.StatusCode,
		"Bug D: non-admin /api/user/teams must be 200; body=%s", string(resp.Body))

	if resp.Result != nil {
		found := false
		for _, it := range *resp.Result {
			if it.ID == teamID {
				found = true
				break
			}
		}
		assert.True(t, found, "Viewer's /api/user/teams should include the team they were added to (teamID=%d)", teamID)
	}
}
