package serviceaccount

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type createTokenRequest struct {
	TokenName        string `json:"tokenName"`
	ExpiresInSeconds int64  `json:"expiresInSeconds"`
}

type createTokenResponse struct {
	Token                   string `json:"token"`
	ServiceAccountTokenName string `json:"serviceAccountTokenName"`
	Expires                 int64  `json:"expires"`
}

type tokenItem struct {
	Title    string `json:"title"`
	Revoked  bool   `json:"revoked"`
	Expires  int64  `json:"expires"`
	Created  int64  `json:"created"`
	Updated  int64  `json:"updated"`
	LastUsed int64  `json:"lastUsed"`
}

type listTokensResponse struct {
	Items    []tokenItem `json:"items"`
	Continue string      `json:"continue"`
}

type getTokenResponse struct {
	Body tokenItem `json:"body"`
}

type deleteTokenResponse struct {
	Message string `json:"message"`
}

func TestIntegrationServiceAccountTokens(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("Service Account Token CRUD with dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"serviceaccounts.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesServiceAccountsApi,
					featuremgmt.FlagKubernetesServiceAccountTokensApi,
				},
			})

			doServiceAccountTokenCRUDTests(t, helper)
		})
	}
}

// createServiceAccount is a test helper that creates a SA and returns its k8s name (UID).
func createServiceAccount(t *testing.T, helper *apis.K8sTestHelper) string {
	t.Helper()
	ctx := context.Background()

	saClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
		GVR:       gvrServiceAccounts,
	})

	created, err := saClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/serviceaccount-test-create-v0.yaml"), metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)

	name := created.GetName()
	require.NotEmpty(t, name)
	return name
}

func tokensPath(ns, saName string) string {
	return fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/serviceaccounts/%s/tokens", ns, saName)
}

func tokenPath(ns, saName, tokenName string) string {
	return fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/serviceaccounts/%s/tokens/%s", ns, saName, tokenName)
}

func doServiceAccountTokenCRUDTests(t *testing.T, helper *apis.K8sTestHelper) {
	ns := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())
	saName := createServiceAccount(t, helper)

	t.Run("should create a token and receive the plaintext key", func(t *testing.T) {
		body, err := json.Marshal(createTokenRequest{
			TokenName:        "test-token-1",
			ExpiresInSeconds: 3600,
		})
		require.NoError(t, err)

		var res createTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   tokensPath(ns, saName),
			Body:   body,
		}, &res)

		require.Equal(t, http.StatusCreated, rsp.Response.StatusCode)
		require.NotEmpty(t, res.Token, "plaintext token should be returned")
		require.Equal(t, "test-token-1", res.ServiceAccountTokenName)
		require.Greater(t, res.Expires, int64(0), "expires should be set")
	})

	t.Run("should list tokens for the service account", func(t *testing.T) {
		var res listTokensResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   tokensPath(ns, saName),
		}, &res)

		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
		require.GreaterOrEqual(t, len(res.Items), 1)

		found := false
		for _, item := range res.Items {
			if item.Title == "test-token-1" {
				found = true
				require.False(t, item.Revoked)
				require.Greater(t, item.Expires, int64(0))
				require.Greater(t, item.Created, int64(0))
				require.Greater(t, item.Updated, int64(0))
			}
		}
		require.True(t, found, "expected to find token 'test-token-1' in list")
	})

	t.Run("should get a single token by name", func(t *testing.T) {
		var res getTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   tokenPath(ns, saName, "test-token-1"),
		}, &res)

		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
		require.Equal(t, "test-token-1", res.Body.Title)
		require.False(t, res.Body.Revoked)
		require.Greater(t, res.Body.Expires, int64(0))
		require.Greater(t, res.Body.Created, int64(0))
	})

	t.Run("should return 404 for non-existent token", func(t *testing.T) {
		var res getTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   tokenPath(ns, saName, "does-not-exist"),
		}, &res)

		require.Equal(t, http.StatusNotFound, rsp.Response.StatusCode)
	})

	t.Run("should return 409 when creating a token with duplicate name", func(t *testing.T) {
		body, err := json.Marshal(createTokenRequest{
			TokenName:        "test-token-1", // already created above
			ExpiresInSeconds: 3600,
		})
		require.NoError(t, err)

		var res createTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   tokensPath(ns, saName),
			Body:   body,
		}, &res)

		require.Equal(t, http.StatusConflict, rsp.Response.StatusCode)
	})

	t.Run("should delete a token", func(t *testing.T) {
		// Create a token to delete.
		body, err := json.Marshal(createTokenRequest{
			TokenName: "token-to-delete",
		})
		require.NoError(t, err)

		var created createTokenResponse
		createRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   tokensPath(ns, saName),
			Body:   body,
		}, &created)
		require.Equal(t, http.StatusCreated, createRsp.Response.StatusCode)
		require.Equal(t, int64(0), created.Expires, "token without expiry should have expires=0")

		// Delete it.
		var delRes deleteTokenResponse
		delRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   tokenPath(ns, saName, "token-to-delete"),
		}, &delRes)
		require.Equal(t, http.StatusOK, delRsp.Response.StatusCode)
		require.Contains(t, delRes.Message, "token-to-delete")

		// Verify it's gone.
		var getRes getTokenResponse
		getRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   tokenPath(ns, saName, "token-to-delete"),
		}, &getRes)
		require.Equal(t, http.StatusNotFound, getRsp.Response.StatusCode)
	})

	t.Run("should return 404 when deleting a non-existent token", func(t *testing.T) {
		var res deleteTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   tokenPath(ns, saName, "does-not-exist"),
		}, &res)

		require.Equal(t, http.StatusNotFound, rsp.Response.StatusCode)
	})

	t.Run("should return 400 when creating a token without a name", func(t *testing.T) {
		body, err := json.Marshal(createTokenRequest{
			TokenName: "",
		})
		require.NoError(t, err)

		var res createTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   tokensPath(ns, saName),
			Body:   body,
		}, &res)

		require.Equal(t, http.StatusBadRequest, rsp.Response.StatusCode)
	})

	t.Run("should create multiple tokens and list them all", func(t *testing.T) {
		for i := range 3 {
			body, err := json.Marshal(createTokenRequest{
				TokenName: fmt.Sprintf("multi-token-%d", i),
			})
			require.NoError(t, err)

			var res createTokenResponse
			rsp := apis.DoRequest(helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: http.MethodPost,
				Path:   tokensPath(ns, saName),
				Body:   body,
			}, &res)
			require.Equal(t, http.StatusCreated, rsp.Response.StatusCode)
		}

		var listRes listTokensResponse
		listRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   tokensPath(ns, saName),
		}, &listRes)

		require.Equal(t, http.StatusOK, listRsp.Response.StatusCode)
		// At least the 3 we just created + test-token-1 from earlier
		require.GreaterOrEqual(t, len(listRes.Items), 4)
	})

	t.Run("should not allow viewer to create tokens", func(t *testing.T) {
		body, err := json.Marshal(createTokenRequest{
			TokenName: "viewer-token",
		})
		require.NoError(t, err)

		var res createTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Viewer,
			Method: http.MethodPost,
			Path:   tokensPath(ns, saName),
			Body:   body,
		}, &res)

		require.Equal(t, http.StatusForbidden, rsp.Response.StatusCode)
	})

	t.Run("should not allow viewer to delete tokens", func(t *testing.T) {
		var res deleteTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Viewer,
			Method: http.MethodDelete,
			Path:   tokenPath(ns, saName, "test-token-1"),
		}, &res)

		require.Equal(t, http.StatusForbidden, rsp.Response.StatusCode)
	})

	t.Run("should paginate token list with continue", func(t *testing.T) {
		// List with limit=2 to force pagination.
		var page1 listTokensResponse
		rsp1 := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   tokensPath(ns, saName) + "?limit=2",
		}, &page1)

		require.Equal(t, http.StatusOK, rsp1.Response.StatusCode)
		require.Len(t, page1.Items, 2)
		require.NotEmpty(t, page1.Continue, "should have continue token for next page")

		// Fetch page 2.
		var page2 listTokensResponse
		rsp2 := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   fmt.Sprintf("%s?limit=2&continue=%s", tokensPath(ns, saName), page1.Continue),
		}, &page2)

		require.Equal(t, http.StatusOK, rsp2.Response.StatusCode)
		require.GreaterOrEqual(t, len(page2.Items), 1, "page 2 should have at least one token")

		// Ensure no overlap between pages.
		page1Titles := map[string]bool{}
		for _, item := range page1.Items {
			page1Titles[item.Title] = true
		}
		for _, item := range page2.Items {
			require.False(t, page1Titles[item.Title], "token %q appeared on both pages", item.Title)
		}
	})

	t.Run("should reject negative expiresInSeconds", func(t *testing.T) {
		body, err := json.Marshal(createTokenRequest{
			TokenName:        "negative-expiry",
			ExpiresInSeconds: -100,
		})
		require.NoError(t, err)

		var res createTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   tokensPath(ns, saName),
			Body:   body,
		}, &res)

		require.Equal(t, http.StatusBadRequest, rsp.Response.StatusCode)
	})

	t.Run("should reject expiresInSeconds exceeding 5 years", func(t *testing.T) {
		body, err := json.Marshal(createTokenRequest{
			TokenName:        "overflow-expiry",
			ExpiresInSeconds: 200_000_000, // ~6.3 years
		})
		require.NoError(t, err)

		var res createTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   tokensPath(ns, saName),
			Body:   body,
		}, &res)

		require.Equal(t, http.StatusBadRequest, rsp.Response.StatusCode)
	})

	t.Run("should reject token name exceeding max length", func(t *testing.T) {
		body, err := json.Marshal(createTokenRequest{
			TokenName: strings.Repeat("a", 200),
		})
		require.NoError(t, err)

		var res createTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   tokensPath(ns, saName),
			Body:   body,
		}, &res)

		require.Equal(t, http.StatusBadRequest, rsp.Response.StatusCode)
	})

	t.Run("should allow token names with dots hyphens and underscores", func(t *testing.T) {
		body, err := json.Marshal(createTokenRequest{
			TokenName: "my-token_v2.prod",
		})
		require.NoError(t, err)

		var res createTokenResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   tokensPath(ns, saName),
			Body:   body,
		}, &res)

		require.Equal(t, http.StatusCreated, rsp.Response.StatusCode)
		require.Equal(t, "my-token_v2.prod", res.ServiceAccountTokenName)

		// Verify we can get it back.
		var getRes getTokenResponse
		getRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   tokenPath(ns, saName, "my-token_v2.prod"),
		}, &getRes)

		require.Equal(t, http.StatusOK, getRsp.Response.StatusCode)
		require.Equal(t, "my-token_v2.prod", getRes.Body.Title)
	})

	t.Run("should reject token names with invalid characters", func(t *testing.T) {
		invalidNames := []string{
			"has spaces",
			"has/slash",
			"has(parens)",
			"has@at",
		}
		for _, name := range invalidNames {
			body, err := json.Marshal(createTokenRequest{
				TokenName: name,
			})
			require.NoError(t, err)

			var res createTokenResponse
			rsp := apis.DoRequest(helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: http.MethodPost,
				Path:   tokensPath(ns, saName),
				Body:   body,
			}, &res)

			require.Equal(t, http.StatusBadRequest, rsp.Response.StatusCode, "token name %q should be rejected", name)
		}
	})
}
