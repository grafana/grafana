package source

import (
	"bytes"
	"fmt"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source/sourceserver"
	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const hintSecret = "hint-secret"

func TestIntegrationSource_HintsTriggerASync(t *testing.T) {
	helper := sharedHelper(t)
	const repoName = "hinted"

	srv, url, _ := startSource(t, sourceserver.TierCompare)
	r1 := srv.Publish(map[string][]byte{"a.json": common.DashboardJSON("hint-a", "A", 1)})

	obj := editRepo(sourceRepo(repoName, url), func(_, secure map[string]any) {
		secure["webhookSecret"] = map[string]any{"create": hintSecret}
	})
	_, err := helper.Repositories.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repoName)
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	helper.RequireRepoDashboardCount(t, repoName, 1)
	requireSyncedRef(t, helper, repoName, r1)

	hookURL := fmt.Sprintf("http://%s/apis/provisioning.grafana.app/v0alpha1/namespaces/%s/repositories/%s/webhook",
		helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), helper.Namespace, repoName)

	t.Run("a hint from the source pulls the change without waiting for the interval", func(t *testing.T) {
		r2 := srv.Publish(map[string][]byte{
			"a.json": common.DashboardJSON("hint-a", "A", 1),
			"b.json": common.DashboardJSON("hint-b", "B", 1),
		})

		// The source calls Grafana anonymously: the signature is the credential.
		require.NoError(t, srv.NotifyWebhook(t.Context(), http.DefaultClient, hookURL, hintSecret))

		helper.RequireRepoDashboardCount(t, repoName, 2)
		requireSyncedRef(t, helper, repoName, r2)
	})

	post := func(t *testing.T, header map[string]string, body []byte) int {
		t.Helper()
		req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, hookURL, bytes.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		for k, v := range header {
			req.Header.Set(k, v)
		}
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()
		return resp.StatusCode
	}
	signed := func(secret string, at time.Time, body []byte) map[string]string {
		return map[string]string{
			sourcev1.HeaderHintTimestamp: strconv.FormatInt(at.Unix(), 10),
			sourcev1.HeaderHintSignature: sourcev1.SignHint(secret, at, body),
			sourcev1.HeaderHintDelivery:  "delivery",
		}
	}
	body := []byte(`{"type":"ping"}`)

	t.Run("a hint with the wrong secret is refused", func(t *testing.T) {
		assert.Equal(t, http.StatusUnauthorized, post(t, signed("wrong", time.Now(), body), body))
	})

	t.Run("a stale hint is refused", func(t *testing.T) {
		assert.Equal(t, http.StatusUnauthorized, post(t, signed(hintSecret, time.Now().Add(-10*time.Minute), body), body))
	})

	t.Run("an unsigned hint is refused", func(t *testing.T) {
		assert.Equal(t, http.StatusUnauthorized, post(t, nil, body))
	})

	t.Run("a replayed hint is dropped", func(t *testing.T) {
		header := signed(hintSecret, time.Now(), body)
		assert.Equal(t, http.StatusOK, post(t, header, body), "the first delivery is processed")
		// Same bytes, new delivery id: only the signature identifies the delivery.
		header[sourcev1.HeaderHintDelivery] = "another-delivery"
		assert.Equal(t, http.StatusOK, post(t, header, body))
	})

	t.Run("a hint for another source is refused", func(t *testing.T) {
		other := []byte(`{"type":"revision","revision":"b81d03c2ee","id":"stacks-2"}`)
		assert.Equal(t, http.StatusBadRequest, post(t, signed(hintSecret, time.Now(), other), other))
	})
}

func TestIntegrationSource_HintsAreOffWithoutASecret(t *testing.T) {
	helper := sharedHelper(t)
	const repoName = "unhinted"

	_, url, _ := startSource(t, sourceserver.TierTree)
	_, err := helper.Repositories.Resource.Create(t.Context(), sourceRepo(repoName, url), metav1.CreateOptions{})
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repoName)

	body := []byte(`{"type":"ping"}`)
	at := time.Now()
	req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, fmt.Sprintf(
		"http://%s/apis/provisioning.grafana.app/v0alpha1/namespaces/%s/repositories/%s/webhook",
		helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), helper.Namespace, repoName), bytes.NewReader(body))
	require.NoError(t, err)
	req.Header.Set(sourcev1.HeaderHintTimestamp, strconv.FormatInt(at.Unix(), 10))
	req.Header.Set(sourcev1.HeaderHintSignature, sourcev1.SignHint("anything", at, body))

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
