package team

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiserverrest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// These tests verify that the K8s adapter returns the same results as the legacy database path
// for team CRUD operations. They must NOT use t.Parallel() because setTeamK8sFeatureToggle
// modifies the global OpenFeature provider.

// go test -timeout 120s -run ^TestIntegrationCreateTeamAPI$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationCreateTeamAPI(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupTeamTestHelper(t)

	// Create via legacy
	setTeamK8sFeatureToggle(t, false)
	legacyTeamID, legacyTeamUID := createTeamViaAPI(t, helper, "legacy-create-test", "legacy-create@example.com")
	t.Cleanup(func() {
		setTeamK8sFeatureToggle(t, false)
		deleteTeamViaAPI(t, helper, legacyTeamID)
	})

	setTeamK8sFeatureToggle(t, false)
	legacyResult := getTeamByIDViaAPI(t, helper, legacyTeamID)
	assert.Equal(t, "legacy-create-test", legacyResult.Name)
	assert.Equal(t, "legacy-create@example.com", legacyResult.Email)

	setTeamK8sFeatureToggle(t, true)
	k8sResult := getTeamByIDViaAPI(t, helper, legacyTeamID)
	assertTeamsMatch(t, legacyResult, k8sResult)

	directK8sResult := getTeamViaK8sAPI(t, helper, legacyTeamUID)
	assertRedirectMatchesK8sAPI(t, k8sResult, directK8sResult)

	// Create via K8s adapter
	setTeamK8sFeatureToggle(t, true)
	k8sTeamID, k8sTeamUID := createTeamViaAPI(t, helper, "k8s-create-test", "k8s-create@example.com")
	t.Cleanup(func() {
		setTeamK8sFeatureToggle(t, false)
		deleteTeamViaAPI(t, helper, k8sTeamID)
	})

	k8sCreatedResult := getTeamByIDViaAPI(t, helper, k8sTeamID)
	assert.Equal(t, "k8s-create-test", k8sCreatedResult.Name)
	assert.Equal(t, "k8s-create@example.com", k8sCreatedResult.Email)

	setTeamK8sFeatureToggle(t, false)
	legacyCrossCheck := getTeamByIDViaAPI(t, helper, k8sTeamID)
	assertTeamsMatch(t, legacyCrossCheck, k8sCreatedResult)

	directK8sCrossCheck := getTeamViaK8sAPI(t, helper, k8sTeamUID)
	assertRedirectMatchesK8sAPI(t, k8sCreatedResult, directK8sCrossCheck)
}

// go test -timeout 120s -run ^TestIntegrationGetTeamByIDAPI$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationGetTeamByIDAPI(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupTeamTestHelper(t)

	setTeamK8sFeatureToggle(t, false)
	teamID, uid := createTeamViaAPI(t, helper, "redirect-get-test", "redirect-get@example.com")
	t.Cleanup(func() {
		setTeamK8sFeatureToggle(t, false)
		deleteTeamViaAPI(t, helper, teamID)
	})

	// GET via legacy
	setTeamK8sFeatureToggle(t, false)
	legacyTeam := getTeamByIDViaAPI(t, helper, teamID)
	assert.Equal(t, "redirect-get-test", legacyTeam.Name)
	assert.Equal(t, "redirect-get@example.com", legacyTeam.Email)

	// GET via K8s adapter
	setTeamK8sFeatureToggle(t, true)
	k8sTeam := getTeamByIDViaAPI(t, helper, teamID)

	assertTeamsMatch(t, legacyTeam, k8sTeam)

	directK8sTeam := getTeamViaK8sAPI(t, helper, uid)
	assertRedirectMatchesK8sAPI(t, k8sTeam, directK8sTeam)
}

// go test -timeout 120s -run ^TestIntegrationUpdateTeamAPI$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationUpdateTeamAPI(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupTeamTestHelper(t)

	// Update via legacy
	setTeamK8sFeatureToggle(t, false)
	legacyTeamID, legacyTeamUID := createTeamViaAPI(t, helper, "legacy-update-test", "legacy-update@example.com")
	t.Cleanup(func() {
		setTeamK8sFeatureToggle(t, false)
		deleteTeamViaAPI(t, helper, legacyTeamID)
	})

	setTeamK8sFeatureToggle(t, false)
	updateTeamViaAPI(t, helper, legacyTeamID, "legacy-updated-name", "legacy-updated@example.com")
	legacyResult := getTeamByIDViaAPI(t, helper, legacyTeamID)
	assert.Equal(t, "legacy-updated-name", legacyResult.Name)
	assert.Equal(t, "legacy-updated@example.com", legacyResult.Email)

	setTeamK8sFeatureToggle(t, true)
	k8sResult := getTeamByIDViaAPI(t, helper, legacyTeamID)
	assertTeamsMatch(t, legacyResult, k8sResult)

	directK8sLegacyUpdate := getTeamViaK8sAPI(t, helper, legacyTeamUID)
	assertRedirectMatchesK8sAPI(t, k8sResult, directK8sLegacyUpdate)

	// Update via K8s adapter
	setTeamK8sFeatureToggle(t, false)
	k8sTeamID, k8sTeamUID := createTeamViaAPI(t, helper, "k8s-update-test", "k8s-update@example.com")
	t.Cleanup(func() {
		setTeamK8sFeatureToggle(t, false)
		deleteTeamViaAPI(t, helper, k8sTeamID)
	})

	setTeamK8sFeatureToggle(t, true)
	updateTeamViaAPI(t, helper, k8sTeamID, "k8s-updated-name", "k8s-updated@example.com")
	k8sUpdatedResult := getTeamByIDViaAPI(t, helper, k8sTeamID)
	assert.Equal(t, "k8s-updated-name", k8sUpdatedResult.Name)
	assert.Equal(t, "k8s-updated@example.com", k8sUpdatedResult.Email)

	// Cross-verify: legacy should see the K8s update
	setTeamK8sFeatureToggle(t, false)
	legacyCrossCheck := getTeamByIDViaAPI(t, helper, k8sTeamID)
	assertTeamsMatch(t, legacyCrossCheck, k8sUpdatedResult)

	directK8sUpdate := getTeamViaK8sAPI(t, helper, k8sTeamUID)
	assertRedirectMatchesK8sAPI(t, k8sUpdatedResult, directK8sUpdate)
}

type teamResponse struct {
	ID            int64  `json:"id"`
	UID           string `json:"uid"`
	OrgID         int64  `json:"orgId"`
	Name          string `json:"name"`
	Email         string `json:"email"`
	ExternalUID   string `json:"externalUID"`
	IsProvisioned bool   `json:"isProvisioned"`
}

func setupTeamTestHelper(t *testing.T) *apis.K8sTestHelper {
	t.Helper()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    false,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"teams.iam.grafana.app": {DualWriterMode: apiserverrest.Mode0},
		},
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagKubernetesTeamsApi,
			featuremgmt.FlagKubernetesTeamsRedirect,
		},
	})

	return helper
}

func setTeamK8sFeatureToggle(t *testing.T, enabled bool) {
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

func createTeamViaAPI(t *testing.T, helper *apis.K8sTestHelper, name, email string) (int64, string) {
	t.Helper()
	body, err := json.Marshal(map[string]string{"name": name, "email": email})
	require.NoError(t, err)

	resp := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin, Method: http.MethodPost, Path: "/api/teams", Body: body,
	}, &struct {
		TeamID int64  `json:"teamId"`
		UID    string `json:"uid"`
	}{})

	require.Equal(t, http.StatusOK, resp.Response.StatusCode)
	return resp.Result.TeamID, resp.Result.UID
}

func getTeamByIDViaAPI(t *testing.T, helper *apis.K8sTestHelper, teamID int64) teamResponse {
	t.Helper()
	resp := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin, Method: http.MethodGet,
		Path: fmt.Sprintf("/api/teams/%d", teamID),
	}, &teamResponse{})
	require.Equal(t, http.StatusOK, resp.Response.StatusCode)
	return *resp.Result
}

func updateTeamViaAPI(t *testing.T, helper *apis.K8sTestHelper, teamID int64, name, email string) {
	t.Helper()
	body, err := json.Marshal(map[string]string{"name": name, "email": email})
	require.NoError(t, err)

	resp := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin, Method: http.MethodPut,
		Path: fmt.Sprintf("/api/teams/%d", teamID), Body: body,
	}, &struct{}{})
	require.Equal(t, http.StatusOK, resp.Response.StatusCode)
}

func addTeamMemberViaAPI(t *testing.T, helper *apis.K8sTestHelper, teamID int64, userID int64) {
	t.Helper()
	body, err := json.Marshal(map[string]int64{"userId": userID})
	require.NoError(t, err)

	resp := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin, Method: http.MethodPost,
		Path: fmt.Sprintf("/api/teams/%d/members", teamID), Body: body,
	}, &struct{}{})
	require.Equal(t, http.StatusOK, resp.Response.StatusCode)
}

func deleteTeamViaAPI(t *testing.T, helper *apis.K8sTestHelper, teamID int64) {
	t.Helper()
	resp := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin, Method: http.MethodDelete,
		Path: fmt.Sprintf("/api/teams/%d", teamID),
	}, &struct{}{})
	if resp.Response.StatusCode != http.StatusOK && resp.Response.StatusCode != http.StatusNotFound {
		t.Errorf("failed to delete team: %s", string(resp.Body))
	}
}

func getTeamViaK8sAPI(t *testing.T, helper *apis.K8sTestHelper, uid string) teamResponse {
	t.Helper()
	teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
		GVR:       gvrTeams,
	})
	fetched, err := teamClient.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	require.NoError(t, err)
	require.NotNil(t, fetched)

	spec := fetched.Object["spec"].(map[string]interface{})

	labels := fetched.GetLabels()
	id, err := strconv.ParseInt(labels["grafana.app/deprecatedInternalID"], 10, 64)
	require.NoError(t, err)

	var isProvisioned bool
	if v, ok := spec["provisioned"]; ok {
		isProvisioned, _ = v.(bool)
	}
	var externalUID string
	if v, ok := spec["externalUID"]; ok {
		externalUID, _ = v.(string)
	}

	return teamResponse{
		ID:            id,
		UID:           fetched.GetName(),
		Name:          spec["title"].(string),
		Email:         spec["email"].(string),
		ExternalUID:   externalUID,
		IsProvisioned: isProvisioned,
	}
}

// go test -timeout 120s -run ^TestIntegrationSearchTeamsRedirect$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationSearchTeamsRedirect(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupTeamTestHelper(t)

	setTeamK8sFeatureToggle(t, false)
	teamID1, _ := createTeamViaAPI(t, helper, "search-redirect-alpha", "alpha@example.com")
	teamID2, _ := createTeamViaAPI(t, helper, "search-redirect-beta", "beta@example.com")
	t.Cleanup(func() {
		setTeamK8sFeatureToggle(t, false)
		deleteTeamViaAPI(t, helper, teamID1)
		deleteTeamViaAPI(t, helper, teamID2)
	})

	t.Run("redirect returns same teams as legacy", func(t *testing.T) {
		setTeamK8sFeatureToggle(t, false)
		legacyResult := searchTeamsViaAPI(t, helper, url.Values{"query": {"search-redirect"}})

		setTeamK8sFeatureToggle(t, true)
		k8sResult := searchTeamsViaAPI(t, helper, url.Values{"query": {"search-redirect"}})

		require.Equal(t, legacyResult.TotalCount, k8sResult.TotalCount)
		require.Equal(t, len(legacyResult.Teams), len(k8sResult.Teams))

		legacyByUID := teamsByUID(legacyResult.Teams)
		k8sByUID := teamsByUID(k8sResult.Teams)
		for uid, legacyTeam := range legacyByUID {
			k8sTeam, ok := k8sByUID[uid]
			require.True(t, ok, "team %s missing from K8s result", uid)
			assertSearchTeamsMatch(t, legacyTeam, k8sTeam)
		}
	})

	t.Run("redirect with query filter", func(t *testing.T) {
		setTeamK8sFeatureToggle(t, false)
		legacyResult := searchTeamsViaAPI(t, helper, url.Values{"query": {"search-redirect-alpha"}})

		setTeamK8sFeatureToggle(t, true)
		k8sResult := searchTeamsViaAPI(t, helper, url.Values{"query": {"search-redirect-alpha"}})

		require.Equal(t, legacyResult.TotalCount, k8sResult.TotalCount)
		require.Equal(t, len(legacyResult.Teams), len(k8sResult.Teams))
		for i := range legacyResult.Teams {
			assertSearchTeamsMatch(t, legacyResult.Teams[i], k8sResult.Teams[i])
		}
	})

	t.Run("redirect with pagination", func(t *testing.T) {
		setTeamK8sFeatureToggle(t, true)
		page1 := searchTeamsViaAPI(t, helper, url.Values{
			"query":   {"search-redirect"},
			"perpage": {"1"},
			"page":    {"1"},
		})
		page2 := searchTeamsViaAPI(t, helper, url.Values{
			"query":   {"search-redirect"},
			"perpage": {"1"},
			"page":    {"2"},
		})

		require.Equal(t, 1, len(page1.Teams))
		require.Equal(t, 1, len(page2.Teams))
		assert.NotEqual(t, page1.Teams[0].UID, page2.Teams[0].UID, "pages should return different teams")
	})

	t.Run("redirect supports sort", func(t *testing.T) {
		setTeamK8sFeatureToggle(t, true)
		result := searchTeamsViaAPI(t, helper, url.Values{
			"query": {"search-redirect"},
			"sort":  {"name-asc"},
		})
		require.GreaterOrEqual(t, len(result.Teams), 2)
	})

	t.Run("redirect includes member counts", func(t *testing.T) {
		setTeamK8sFeatureToggle(t, false)
		editorID, err := helper.Org1.Editor.Identity.GetInternalID()
		require.NoError(t, err)
		addTeamMemberViaAPI(t, helper, teamID1, editorID)

		setTeamK8sFeatureToggle(t, true)
		result := searchTeamsViaAPI(t, helper, url.Values{"query": {"search-redirect"}})

		resultByUID := teamsByUID(result.Teams)

		setTeamK8sFeatureToggle(t, false)
		legacyAlpha := searchTeamsViaAPI(t, helper, url.Values{"query": {"search-redirect-alpha"}})
		require.Equal(t, 1, len(legacyAlpha.Teams))
		alphaUID := legacyAlpha.Teams[0].UID

		legacyBeta := searchTeamsViaAPI(t, helper, url.Values{"query": {"search-redirect-beta"}})
		require.Equal(t, 1, len(legacyBeta.Teams))
		betaUID := legacyBeta.Teams[0].UID

		assert.Equal(t, int64(2), resultByUID[alphaUID].MemberCount, "alpha should have 2 members")
		assert.Equal(t, int64(1), resultByUID[betaUID].MemberCount, "beta should have 1 member")
	})

	t.Run("redirect matches direct K8s API", func(t *testing.T) {
		setTeamK8sFeatureToggle(t, true)
		redirectResult := searchTeamsViaAPI(t, helper, url.Values{"query": {"search-redirect"}})

		namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())
		directResult := searchTeamsViaK8sAPI(t, helper, namespace, "search-redirect")

		require.Equal(t, directResult.TotalHits, redirectResult.TotalCount)
		require.Equal(t, len(directResult.Hits), len(redirectResult.Teams))

		hitsByName := make(map[string]iamv0alpha1.GetSearchTeamsTeamHit, len(directResult.Hits))
		for _, hit := range directResult.Hits {
			hitsByName[hit.Name] = hit
		}
		for _, t2 := range redirectResult.Teams {
			hit, ok := hitsByName[t2.UID]
			require.True(t, ok, "team %s missing from direct K8s result", t2.UID)
			assert.Equal(t, hit.Title, t2.Name)
			assert.Equal(t, hit.Email, t2.Email)
			if hit.MemberCount != nil {
				assert.Equal(t, *hit.MemberCount, t2.MemberCount)
			}
		}
	})
}

// go test -timeout 120s -run ^TestIntegrationServiceIdentityFallbackToLegacy$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationServiceIdentityFallbackToLegacy(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupTeamTestHelper(t)

	setTeamK8sFeatureToggle(t, false)
	teamID, _ := createTeamViaAPI(t, helper, "svc-identity-fallback", "fallback@example.com")
	t.Cleanup(func() {
		setTeamK8sFeatureToggle(t, false)
		deleteTeamViaAPI(t, helper, teamID)
	})

	env := helper.GetEnv()
	teamSvc, err := teamimpl.ProvideService(env.SQLStore, env.Cfg, tracing.NewNoopTracerService(), nil)
	require.NoError(t, err)

	setTeamK8sFeatureToggle(t, true)

	signedInUser := &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {ac.ActionTeamsRead: []string{ac.ScopeTeamsAll}},
		},
	}
	svcCtx := identity.WithServiceIdentityContext(context.Background(), 1)

	t.Run("SearchTeams with service identity falls back to legacy", func(t *testing.T) {
		result, err := teamSvc.SearchTeams(svcCtx, &team.SearchTeamsQuery{
			OrgID:        1,
			Query:        "svc-identity-fallback",
			SignedInUser: signedInUser,
		})
		require.NoError(t, err)
		assert.Equal(t, int64(1), result.TotalCount)
		assert.Equal(t, "svc-identity-fallback", result.Teams[0].Name)
	})

	t.Run("GetTeamByID with service identity falls back to legacy", func(t *testing.T) {
		result, err := teamSvc.GetTeamByID(svcCtx, &team.GetTeamByIDQuery{
			ID:           teamID,
			OrgID:        1,
			SignedInUser: signedInUser,
		})
		require.NoError(t, err)
		assert.Equal(t, "svc-identity-fallback", result.Name)
	})

	t.Run("SearchTeams without service identity routes to k8s", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), signedInUser)
		_, err := teamSvc.SearchTeams(ctx, &team.SearchTeamsQuery{
			OrgID:        1,
			Query:        "svc-identity-fallback",
			SignedInUser: signedInUser,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "config provider not initialized")
	})

	t.Run("GetTeamByID without service identity routes to k8s", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), signedInUser)
		_, err := teamSvc.GetTeamByID(ctx, &team.GetTeamByIDQuery{
			ID:           teamID,
			OrgID:        1,
			SignedInUser: signedInUser,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "config provider not initialized")
	})
}

func searchTeamsViaAPI(t *testing.T, helper *apis.K8sTestHelper, params url.Values) team.SearchTeamQueryResult {
	t.Helper()
	path := "/api/teams/search?" + params.Encode()
	result := &team.SearchTeamQueryResult{}
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   path,
	}, result)
	require.Equal(t, http.StatusOK, resp.Response.StatusCode)
	return *resp.Result
}

func searchTeamsViaK8sAPI(t *testing.T, helper *apis.K8sTestHelper, namespace, query string) iamv0alpha1.GetSearchTeamsResponse {
	t.Helper()
	path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?query=%s&accesscontrol=true&membercount=true&limit=100", namespace, url.QueryEscape(query))
	result := &iamv0alpha1.GetSearchTeamsResponse{}
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   path,
	}, result)
	require.Equal(t, http.StatusOK, resp.Response.StatusCode)
	return *resp.Result
}

func teamsByUID(teams []*team.TeamDTO) map[string]*team.TeamDTO {
	m := make(map[string]*team.TeamDTO, len(teams))
	for _, t := range teams {
		m[t.UID] = t
	}
	return m
}

// --- Assertion helpers ---

func assertTeamsMatch(t *testing.T, legacy, k8s teamResponse) {
	t.Helper()
	assert.Equal(t, legacy.ID, k8s.ID)
	assert.Equal(t, legacy.UID, k8s.UID)
	assert.Equal(t, legacy.OrgID, k8s.OrgID)
	assert.Equal(t, legacy.Name, k8s.Name)
	assert.Equal(t, legacy.Email, k8s.Email)
	assert.Equal(t, legacy.ExternalUID, k8s.ExternalUID)
	assert.Equal(t, legacy.IsProvisioned, k8s.IsProvisioned)
}

func assertRedirectMatchesK8sAPI(t *testing.T, redirectTeam, directK8sTeam teamResponse) {
	t.Helper()
	assert.Equal(t, redirectTeam.ID, directK8sTeam.ID)
	assert.Equal(t, redirectTeam.UID, directK8sTeam.UID)
	assert.Equal(t, redirectTeam.Name, directK8sTeam.Name)
	assert.Equal(t, redirectTeam.Email, directK8sTeam.Email)
	assert.Equal(t, redirectTeam.ExternalUID, directK8sTeam.ExternalUID)
	assert.Equal(t, redirectTeam.IsProvisioned, directK8sTeam.IsProvisioned)
}

func assertSearchTeamsMatch(t *testing.T, legacy, k8s *team.TeamDTO) {
	t.Helper()
	assert.Equal(t, legacy.UID, k8s.UID)
	assert.Equal(t, legacy.OrgID, k8s.OrgID)
	assert.Equal(t, legacy.Name, k8s.Name)
	assert.Equal(t, legacy.Email, k8s.Email)
	assert.Equal(t, legacy.ExternalUID, k8s.ExternalUID)
	assert.Equal(t, legacy.IsProvisioned, k8s.IsProvisioned)
	assert.Equal(t, legacy.MemberCount, k8s.MemberCount)
}
