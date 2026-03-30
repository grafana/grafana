package identity

import (
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// These tests verify that searching teams via the legacy /api/teams/search endpoint
// returns consistent results when the K8s redirect is enabled vs disabled.
// They must NOT use t.Parallel() because setTeamK8sFeatureToggle modifies the global
// OpenFeature provider.

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

	t.Run("sort falls back to legacy", func(t *testing.T) {
		setTeamK8sFeatureToggle(t, true)
		result := searchTeamsViaAPI(t, helper, url.Values{
			"query": {"search-redirect"},
			"sort":  {"name-asc"},
		})
		require.GreaterOrEqual(t, len(result.Teams), 2)
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
		}
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
	path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?query=%s&accesscontrol=true&limit=100", namespace, url.QueryEscape(query))
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
