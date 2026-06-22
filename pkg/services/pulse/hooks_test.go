package pulse

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationPulseHooks_CRUD(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)

	// Create
	h, err := s.CreateHook(ctx, CreateHookCommand{
		OrgID:     1,
		CreatedBy: 7,
		Name:      "Grafana-P.S.",
		Type:      HookTypeWebhook,
		URL:       "https://example.com/hook",
		Secret:    "topsecret",
	})
	require.NoError(t, err)
	require.NotEmpty(t, h.UID)
	require.Equal(t, "Grafana-P.S.", h.Name)
	require.Equal(t, HookTypeWebhook, h.Type)

	// Sanitized strips the secret but reports its presence.
	san := h.Sanitized()
	require.Empty(t, san.Secret)
	require.True(t, san.HasSecret)

	// Get
	got, err := s.GetHook(ctx, 1, h.UID)
	require.NoError(t, err)
	require.Equal(t, "topsecret", got.Secret)

	// Duplicate name (case-insensitive) is rejected.
	_, err = s.CreateHook(ctx, CreateHookCommand{
		OrgID: 1, CreatedBy: 7, Name: "grafana-p.s.", URL: "https://example.com/other",
	})
	require.ErrorIs(t, err, ErrHookNameDuplicate)

	// Same name in a different org is fine.
	_, err = s.CreateHook(ctx, CreateHookCommand{
		OrgID: 2, CreatedBy: 7, Name: "Grafana-P.S.", URL: "https://example.com/hook",
	})
	require.NoError(t, err)

	// Update without secret keeps the stored secret.
	upd, err := s.UpdateHook(ctx, UpdateHookCommand{
		OrgID: 1, UID: h.UID, Name: "Renamed", Type: HookTypeWebhook, URL: "https://example.com/v2",
	})
	require.NoError(t, err)
	require.Equal(t, "Renamed", upd.Name)
	require.Equal(t, "topsecret", upd.Secret)

	// Update with empty-string secret clears it.
	empty := ""
	upd2, err := s.UpdateHook(ctx, UpdateHookCommand{
		OrgID: 1, UID: h.UID, Name: "Renamed", Type: HookTypeWebhook, URL: "https://example.com/v2", Secret: &empty,
	})
	require.NoError(t, err)
	require.Empty(t, upd2.Secret)

	// List
	hooks, err := s.ListHooks(ctx, ListHooksQuery{OrgID: 1})
	require.NoError(t, err)
	require.Len(t, hooks, 1)

	// Delete
	require.NoError(t, s.DeleteHook(ctx, DeleteHookCommand{OrgID: 1, UID: h.UID}))
	_, err = s.GetHook(ctx, 1, h.UID)
	require.ErrorIs(t, err, ErrHookNotFound)

	// Delete again is a not-found.
	require.ErrorIs(t, s.DeleteHook(ctx, DeleteHookCommand{OrgID: 1, UID: h.UID}), ErrHookNotFound)
}

func TestPulseHooks_Validation(t *testing.T) {
	ctx := context.Background()
	s := newTestService(t)

	cases := []struct {
		name string
		cmd  CreateHookCommand
		want error
	}{
		{"empty name", CreateHookCommand{OrgID: 1, Name: "  ", URL: "https://x.com"}, ErrHookNameRequired},
		{"bad url", CreateHookCommand{OrgID: 1, Name: "n", URL: "not-a-url"}, ErrHookInvalidURL},
		{"ftp url", CreateHookCommand{OrgID: 1, Name: "n", URL: "ftp://x.com"}, ErrHookInvalidURL},
		{"javascript url", CreateHookCommand{OrgID: 1, Name: "n", URL: "javascript:alert(1)"}, ErrHookInvalidURL},
		{"bad type", CreateHookCommand{OrgID: 1, Name: "n", Type: "slack", URL: "https://x.com"}, ErrHookInvalidType},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := s.CreateHook(ctx, tc.cmd)
			require.ErrorIs(t, err, tc.want)
		})
	}

	// Empty type defaults to webhook.
	h, err := s.CreateHook(ctx, CreateHookCommand{OrgID: 1, Name: "default-type", URL: "http://x.com/y"})
	require.NoError(t, err)
	require.Equal(t, HookTypeWebhook, h.Type)
}

func TestIntegrationPulseHooks_Mentionable(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)

	mk := func(name string, disabled bool) {
		_, err := s.CreateHook(ctx, CreateHookCommand{OrgID: 1, Name: name, URL: "https://x.com/" + name, Disabled: disabled})
		require.NoError(t, err)
	}
	mk("alpha", false)
	mk("alfred", false)
	mk("beta", false)
	mk("gamma-disabled", true)

	// Substring match, case-insensitive.
	hits, err := s.ListMentionableHooks(ctx, MentionableHooksQuery{OrgID: 1, Query: "AL"})
	require.NoError(t, err)
	names := make([]string, 0, len(hits))
	for _, h := range hits {
		names = append(names, h.Name)
	}
	require.ElementsMatch(t, []string{"alpha", "alfred"}, names)

	// Disabled hooks never surface.
	all, err := s.ListMentionableHooks(ctx, MentionableHooksQuery{OrgID: 1})
	require.NoError(t, err)
	require.Len(t, all, 3)

	// Limit is respected.
	limited, err := s.ListMentionableHooks(ctx, MentionableHooksQuery{OrgID: 1, Limit: 1})
	require.NoError(t, err)
	require.Len(t, limited, 1)
}

func TestIntegrationPulseHooks_DispatchOnMention(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)
	// Real cfg so the dispatcher builds an absolute resource URL.
	s.dispatcher = newWebhookDispatcher(&setting.Cfg{AppURL: "https://grafana.example/"}, log.New("pulse.test"))

	var received atomic.Int32
	var gotSignature, gotEvent string
	var gotBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received.Add(1)
		gotSignature = r.Header.Get(headerSignature)
		gotEvent = r.Header.Get(headerEvent)
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	hook, err := s.CreateHook(ctx, CreateHookCommand{OrgID: 1, CreatedBy: 7, Name: "Grafana-PS", URL: srv.URL, Secret: "shh"})
	require.NoError(t, err)

	body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[` +
		`{"type":"text","text":"ping "},{"type":"mention","mention":{"kind":"webhook","targetId":"` + hook.UID + `","displayName":"Grafana-PS"}}]}]}}`)

	res, err := s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "dash1", PanelID: ptr(int64(3)), Title: "demo", Body: body,
	})
	require.NoError(t, err)

	s.dispatcher.wait()
	require.Equal(t, int32(1), received.Load())
	require.NotEmpty(t, gotSignature)
	require.Equal(t, string(EventThreadCreated), gotEvent)

	var payload WebhookPayload
	require.NoError(t, json.Unmarshal(gotBody, &payload))
	require.Equal(t, WebhookPayloadVersion, payload.Version)
	require.Equal(t, res.Thread.UID, payload.Thread.UID)
	require.Equal(t, "dash1", payload.Resource.UID)
	require.NotNil(t, payload.Resource.PanelID)
	require.Equal(t, int64(3), *payload.Resource.PanelID)
	require.Equal(t, hook.UID, payload.Hook.UID)
	require.Contains(t, payload.Resource.URL, "https://grafana.example/d/dash1?pulse=thread-")

	// Reply mentioning the hook fires again with the reply event.
	reply := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[` +
		`{"type":"text","text":"again "},{"type":"mention","mention":{"kind":"webhook","targetId":"` + hook.UID + `","displayName":"Grafana-PS"}}]}]}}`)
	_, err = s.AddPulse(ctx, AddPulseCommand{OrgID: 1, ThreadUID: res.Thread.UID, AuthorUserID: 8, Body: reply})
	require.NoError(t, err)
	s.dispatcher.wait()
	require.Equal(t, int32(2), received.Load())
}

func TestIntegrationPulseHooks_DispatchSkipsDisabledAndBadURL(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)
	s.dispatcher = newWebhookDispatcher(&setting.Cfg{AppURL: "https://grafana.example/"}, log.New("pulse.test"))

	var received atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received.Add(1)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	// A disabled hook must not fire even when mentioned.
	disabled, err := s.CreateHook(ctx, CreateHookCommand{OrgID: 1, Name: "off", URL: srv.URL, Disabled: true})
	require.NoError(t, err)

	body := mentionBody(disabled.UID)
	_, err = s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "d", Body: body,
	})
	require.NoError(t, err)
	s.dispatcher.wait()
	require.Equal(t, int32(0), received.Load())

	// A hook with an unreachable URL fails dispatch but never blocks the
	// pulse write (CreateThread already returned NoError above pattern).
	bad, err := s.CreateHook(ctx, CreateHookCommand{OrgID: 1, Name: "bad", URL: "http://127.0.0.1:0/nope"})
	require.NoError(t, err)
	_, err = s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "d2", Body: mentionBody(bad.UID),
	})
	require.NoError(t, err)
	s.dispatcher.wait() // does not panic / hang
}

func TestSignPayload(t *testing.T) {
	// Stable, deterministic HMAC so receivers can reproduce it.
	got := signPayload("secret", []byte("payload"))
	require.Len(t, got, 64) // hex sha256
	require.Equal(t, got, signPayload("secret", []byte("payload")))
	require.NotEqual(t, got, signPayload("other", []byte("payload")))
}

func TestBuildWebhookPayload_NoAppURL(t *testing.T) {
	p := buildWebhookPayload(nil, EventPulseAdded, Thread{UID: "t", OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: "d"}, Pulse{UID: "p"}, Hook{UID: "h", Name: "n", Type: HookTypeWebhook}, time.Unix(0, 0).UTC())
	require.Empty(t, p.Resource.URL)
	require.Equal(t, EventPulseAdded, p.Event)
}

func mentionBody(hookUID string) json.RawMessage {
	return json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[` +
		`{"type":"text","text":"x "},{"type":"mention","mention":{"kind":"webhook","targetId":"` + hookUID + `","displayName":"h"}}]}]}}`)
}

func ptr[T any](v T) *T { return &v }
