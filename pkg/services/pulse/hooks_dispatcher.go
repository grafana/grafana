package pulse

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// hookDispatchTimeout bounds a single outbound POST. The receiver's
	// response is irrelevant to us (fire-and-forget), so this only
	// guards against a hung connection leaking a goroutine.
	hookDispatchTimeout = 10 * time.Second
	// hookMaxResponseBytes caps how much of the response body we drain
	// for logging. We never parse it; draining a little keeps the
	// connection reusable.
	hookMaxResponseBytes = 4 * 1024

	headerEvent     = "X-Grafana-Pulse-Event"
	headerSignature = "X-Grafana-Pulse-Signature"
	headerHookUID   = "X-Grafana-Pulse-Hook-Uid"
	userAgent       = "Grafana-Pulse-Hooks/1.0"
)

// webhookDispatcher POSTs standardized payloads to hook URLs. It owns a
// single tuned http.Client (connection pooling) and a WaitGroup so
// tests can deterministically wait for in-flight goroutines.
type webhookDispatcher struct {
	cfg    *setting.Cfg
	log    log.Logger
	client *http.Client
	// wg tracks outstanding async dispatches. Production never waits on
	// it (fire-and-forget), but tests call wait() to assert delivery.
	wg sync.WaitGroup
	// now is injectable so tests can assert TriggeredAt deterministically.
	now func() time.Time
}

func newWebhookDispatcher(cfg *setting.Cfg, logger log.Logger) *webhookDispatcher {
	if logger == nil {
		logger = log.New("pulse.hooks")
	}
	return &webhookDispatcher{
		cfg: cfg,
		log: logger,
		client: &http.Client{
			Timeout: hookDispatchTimeout,
		},
		now: func() time.Time { return time.Now().UTC() },
	}
}

// dispatchWebhooks resolves the webhook mentions on a saved pulse to
// their hook rows and fires each one asynchronously. It is best-effort
// by contract: a missing hook, a bad URL, or a non-2xx response never
// affects the pulse write that triggered it — failures are counted and
// logged only.
func (s *PulseService) dispatchWebhooks(ctx context.Context, action EventAction, thread Thread, pulse Pulse, mentions []Mention) {
	if s.dispatcher == nil || s.hookStore == nil {
		return
	}
	uids := collectWebhookHookUIDs(mentions)
	if len(uids) == 0 {
		return
	}
	hooks, err := s.hookStore.listHooksByUIDs(ctx, thread.OrgID, uids)
	if err != nil {
		s.log.Warn("failed to resolve pulse hooks for dispatch", "err", err, "threadUID", thread.UID)
		return
	}
	for _, h := range hooks {
		payload := buildWebhookPayload(s.dispatcher.cfg, action, thread, pulse, h, s.dispatcher.now())
		s.dispatcher.dispatch(h, payload)
	}
}

// dispatch sends one payload to one hook in a detached goroutine. The
// request uses a fresh background context (not the originating HTTP
// request's, which is cancelled the moment the API responds) bounded by
// the client timeout.
func (d *webhookDispatcher) dispatch(hook Hook, payload WebhookPayload) {
	body, err := json.Marshal(payload)
	if err != nil {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultDropped).Inc()
		d.log.Warn("failed to marshal pulse hook payload", "err", err, "hookUID", hook.UID)
		return
	}
	d.wg.Add(1)
	go func() {
		defer d.wg.Done()
		d.send(hook, body, payload.Event)
	}()
}

func (d *webhookDispatcher) send(hook Hook, body []byte, event EventAction) {
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), hookDispatchTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, hook.URL, bytes.NewReader(body))
	if err != nil {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultError).Inc()
		d.log.Warn("failed to build pulse hook request", "err", err, "hookUID", hook.UID)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set(headerEvent, string(event))
	req.Header.Set(headerHookUID, hook.UID)
	if hook.Secret != "" {
		req.Header.Set(headerSignature, "sha256="+signPayload(hook.Secret, body))
	}

	resp, err := d.client.Do(req)
	dur := time.Since(start).Seconds()
	hookDispatchDuration.WithLabelValues(string(hook.Type)).Observe(dur)
	if err != nil {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultError).Inc()
		d.log.Warn("pulse hook dispatch failed", "err", err, "hookUID", hook.UID, "hookName", hook.Name, "durationSeconds", dur)
		return
	}
	defer func() {
		// Drain a bounded amount so the connection can be reused, then close.
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, hookMaxResponseBytes))
		_ = resp.Body.Close()
	}()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultError).Inc()
		d.log.Warn("pulse hook returned non-2xx",
			"hookUID", hook.UID, "hookName", hook.Name, "status", resp.StatusCode, "durationSeconds", dur)
		return
	}
	hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultSuccess).Inc()
	d.log.Info("pulse hook dispatched", "hookUID", hook.UID, "hookName", hook.Name, "status", resp.StatusCode, "durationSeconds", dur)
}

// wait blocks until all in-flight dispatches finish. Test-only helper;
// production code never calls it (dispatch is fire-and-forget).
func (d *webhookDispatcher) wait() {
	d.wg.Wait()
}

// signPayload returns the hex-encoded HMAC-SHA256 of body keyed by the
// hook secret, so a receiver can verify the request really came from
// this Grafana instance. Format mirrors the common `sha256=<hex>`
// convention used by GitHub-style webhooks.
func signPayload(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

// buildWebhookPayload assembles the standardized JSON body. The
// resource URL is an absolute deeplink with the thread auto-expanded so
// a receiving agent can both act via the API and link a human back to
// the conversation.
func buildWebhookPayload(cfg *setting.Cfg, action EventAction, thread Thread, pulse Pulse, hook Hook, at time.Time) WebhookPayload {
	return WebhookPayload{
		Version:     WebhookPayloadVersion,
		Event:       action,
		TriggeredAt: at,
		OrgID:       thread.OrgID,
		Hook: WebhookPayloadHook{
			UID:  hook.UID,
			Name: hook.Name,
			Type: hook.Type,
		},
		Resource: WebhookPayloadRes{
			Kind:    thread.ResourceKind,
			UID:     thread.ResourceUID,
			PanelID: thread.PanelID,
			URL:     resourceDeepLink(cfg, thread),
		},
		Thread: WebhookPayloadThr{
			UID:   thread.UID,
			Title: thread.Title,
		},
		Pulse: WebhookPayloadPul{
			UID:          pulse.UID,
			ParentUID:    pulse.ParentUID,
			AuthorUserID: pulse.AuthorUserID,
			AuthorKind:   pulse.AuthorKind,
			BodyText:     pulse.BodyText,
			Body:         pulse.BodyJSON,
			Created:      pulse.Created,
		},
	}
}

// resourceDeepLink builds an absolute URL to the thread's resource with
// the thread auto-expanded. Mirrors EmailNotifier.threadURL so links in
// emails and webhook payloads point to the same place. Returns "" when
// AppURL is unset (e.g. some test configs) rather than a relative path.
func resourceDeepLink(cfg *setting.Cfg, thread Thread) string {
	if cfg == nil || strings.TrimSpace(cfg.AppURL) == "" {
		return ""
	}
	root := strings.TrimRight(cfg.AppURL, "/") + "/"
	if thread.ResourceKind == ResourceKindDashboard && thread.ResourceUID != "" {
		return fmt.Sprintf("%sd/%s?pulse=thread-%s", root, thread.ResourceUID, thread.UID)
	}
	return fmt.Sprintf("%spulse?thread=%s", root, thread.UID)
}
