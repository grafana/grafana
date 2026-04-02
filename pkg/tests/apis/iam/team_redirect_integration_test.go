package identity

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	apiserverrest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
