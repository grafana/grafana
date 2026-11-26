package source

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source/sourceserver"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationSource_ClientCredentials(t *testing.T) {
	helper := sharedHelper(t)
	const (
		connName = "remote"
		repoName = "remote-source"
		minted   = "minted-access-token"
	)

	// The remote token endpoint hands out the credential its source accepts.
	var grants atomic.Int32
	idp := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if assert.NoError(t, r.ParseForm()) && r.PostForm.Get("grant_type") == "client_credentials" {
			grants.Add(1)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"` + minted + `","token_type":"Bearer","expires_in":3600}`))
	}))
	t.Cleanup(idp.Close)

	srv, url, calls := startSourceWith(t, sourceserver.Options{Tier: sourceserver.TierCompare, Token: minted})
	srv.Publish(map[string][]byte{"a.json": common.DashboardJSON("cc-a", "A", 1)})

	conn := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata":   map[string]any{"name": connName},
		"spec": map[string]any{
			"title":  connName,
			"type":   "source",
			"oauth":  map[string]any{"clientID": "client-id"},
			"source": map[string]any{"tokenURL": idp.URL + "/oauth/token", "audience": "source.example.com", "scopes": []any{"read"}},
		},
		"secure": map[string]any{"clientSecret": map[string]any{"create": "client-secret-value"}},
	}}
	_, err := helper.Connections.Resource.Create(t.Context(), conn, metav1.CreateOptions{})
	require.NoError(t, err)

	t.Run("the connection controller mints and tracks the token", func(t *testing.T) {
		helper.WaitForHealthyConnection(t, connName)

		got, err := helper.Connections.Resource.Get(t.Context(), connName, metav1.GetOptions{})
		require.NoError(t, err)
		expiration, found, _ := unstructured.NestedInt64(got.Object, "status", "token", "expiration")
		require.True(t, found, "the expiry is persisted so the controller can refresh before it lapses")
		assert.Positive(t, expiration)
		assert.Positive(t, grants.Load())
	})

	t.Run("a repository syncs with the token the controller mints for it from the connection", func(t *testing.T) {
		repo := editRepo(sourceRepo(repoName, url), func(spec, secure map[string]any) {
			delete(secure, "token")
			spec["connection"] = map[string]any{"name": connName}
			spec["source"].(map[string]any)["auth"] = map[string]any{"type": "clientCredentials"}
		})
		_, err := helper.Repositories.Resource.Create(t.Context(), repo, metav1.CreateOptions{})
		require.NoError(t, err)
		helper.WaitForHealthyRepository(t, repoName)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		helper.RequireRepoDashboardCount(t, repoName, 1)
		assert.Positive(t, calls.count("/tree"))
	})
}

func TestIntegrationSource_ClientCredentialsAreRejected(t *testing.T) {
	helper := sharedHelper(t)

	idp := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"invalid_client"}`))
	}))
	t.Cleanup(idp.Close)

	conn := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata":   map[string]any{"name": "rejected"},
		"spec": map[string]any{
			"title":  "rejected",
			"type":   "source",
			"oauth":  map[string]any{"clientID": "client-id"},
			"source": map[string]any{"tokenURL": idp.URL},
		},
		"secure": map[string]any{"clientSecret": map[string]any{"create": "wrong"}},
	}}
	_, err := helper.Connections.Resource.Create(t.Context(), conn, metav1.CreateOptions{})
	require.NoError(t, err)

	helper.TriggerConnectionReconciliation(t, "rejected")
	require.Never(t, func() bool {
		got, err := helper.Connections.Resource.Get(t.Context(), "rejected", metav1.GetOptions{})
		if err != nil {
			return false
		}
		healthy, _, _ := unstructured.NestedBool(got.Object, "status", "health", "healthy")
		return healthy
	}, common.WaitIntervalDefault*5, common.WaitIntervalDefault, "a connection whose credentials are refused must not report healthy")
}
