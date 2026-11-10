package sourceserver_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source/sourceserver"
	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
)

func TestNotifyWebhook(t *testing.T) {
	srv := sourceserver.New(sourceserver.Options{ID: "stacks-1"})
	revision := srv.Publish(map[string][]byte{"a.yaml": []byte("a")})

	var (
		body     []byte
		header   http.Header
		deliver  = map[string]bool{}
		receiver = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, _ = io.ReadAll(r.Body)
			header = r.Header.Clone()
			deliver[r.Header.Get(sourcev1.HeaderHintDelivery)] = true
		}))
	)
	t.Cleanup(receiver.Close)

	require.NoError(t, srv.NotifyWebhook(t.Context(), receiver.Client(), receiver.URL, "shared"))

	var hint sourcev1.Hint
	require.NoError(t, json.Unmarshal(body, &hint))
	assert.Equal(t, sourcev1.Hint{Type: sourcev1.HintRevision, Revision: revision, ID: "stacks-1"}, hint, "a hint carries a revision only")

	assert.True(t, sourcev1.VerifyHintSignature("shared", header.Get(sourcev1.HeaderHintTimestamp), body, header.Get(sourcev1.HeaderHintSignature)))
	assert.False(t, sourcev1.VerifyHintSignature("other", header.Get(sourcev1.HeaderHintTimestamp), body, header.Get(sourcev1.HeaderHintSignature)))

	require.NoError(t, srv.NotifyWebhook(t.Context(), receiver.Client(), receiver.URL, "shared"))
	assert.Len(t, deliver, 2, "every delivery has its own id")
}

func TestNotifyJob(t *testing.T) {
	srv := sourceserver.New(sourceserver.Options{ID: "stacks-1"})

	status := http.StatusCreated
	var gotBody string
	receiver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.WriteHeader(status)
	}))
	t.Cleanup(receiver.Close)

	require.NoError(t, srv.NotifyJob(t.Context(), receiver.Client(), receiver.URL))
	assert.JSONEq(t, `{"spec":{"action":"pull","pull":{"incremental":true}}}`, gotBody)

	status = http.StatusConflict
	assert.NoError(t, srv.NotifyJob(t.Context(), receiver.Client(), receiver.URL), "the job is a per-repository singleton, so a duplicate is fine")

	status = http.StatusForbidden
	assert.ErrorContains(t, srv.NotifyJob(t.Context(), receiver.Client(), receiver.URL), "403")
}
