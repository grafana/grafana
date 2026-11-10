package sourceserver

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
)

// NotifyWebhook sends the current revision as a signed hint to a repository's webhook
// endpoint. This is the transport for sources that call Grafana over the network. A lost hint is harmless:
// the next poll finds the change.
func (s *Server) NotifyWebhook(ctx context.Context, client *http.Client, url, secret string) error {
	body, err := json.Marshal(sourcev1.Hint{Type: sourcev1.HintRevision, Revision: s.current().revision, ID: s.opts.ID})
	if err != nil {
		return err
	}

	delivery := make([]byte, 16)
	if _, err := rand.Read(delivery); err != nil {
		return err
	}

	return post(ctx, client, url, body, map[string]string{
		sourcev1.HeaderHintTimestamp: fmt.Sprint(time.Now().Unix()),
		sourcev1.HeaderHintDelivery:  hex.EncodeToString(delivery),
		sourcev1.HeaderHintSignature: sourcev1.SignHint(secret, time.Now(), body),
	})
}

// NotifyJob asks a repository to pull now by creating a pull job. The caller's
// client carries an identity Grafana accepts, and the job name is a per-repository
// singleton, so a duplicate is a conflict that can be ignored.
func (s *Server) NotifyJob(ctx context.Context, client *http.Client, jobsURL string) error {
	body := []byte(`{"spec":{"action":"pull","pull":{"incremental":true}}}`)
	return post(ctx, client, jobsURL, body, nil)
}

func post(ctx context.Context, client *http.Client, url string, body []byte, header map[string]string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range header {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusConflict {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("hint refused with status %d: %s", resp.StatusCode, detail)
	}
	return nil
}
