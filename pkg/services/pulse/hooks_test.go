package pulse

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

	mcp, err := s.CreateHook(ctx, CreateHookCommand{OrgID: 1, Name: "mcp-type", Type: HookTypeMCP, URL: "https://x.com/mcp"})
	require.NoError(t, err)
	require.Equal(t, HookTypeMCP, mcp.Type)
	agent, err := s.CreateHook(ctx, CreateHookCommand{OrgID: 1, Name: "agent-type", Type: HookTypeAgent, URL: "https://x.com/pulse/chat"})
	require.NoError(t, err)
	require.Equal(t, HookTypeAgent, agent.Type)
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

func TestIntegrationPulseHooks_MCPDispatchPostsAssistantReply(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)
	s.features = featuremgmt.WithFeatures(featuremgmt.FlagDashboardPulseAssistant)

	var calls atomic.Int32
	var gotAuth atomic.Value
	var gotOuterHeader atomic.Value
	var gotSecretHeader atomic.Value
	var sawSession atomic.Bool
	const outerHeader = "X-Test-Caller-Authorization"
	const secretHeader = "X-Test-MCP-Session"
	toolReqCh := make(chan map[string]any, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		gotAuth.Store(r.Header.Get("Authorization"))
		gotOuterHeader.Store(r.Header.Get(outerHeader))
		gotSecretHeader.Store(r.Header.Get(secretHeader))

		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		method, _ := req["method"].(string)
		switch method {
		case "initialize":
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set(mcpHeaderSessionID, "session-1")
			_, _ = io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{}}}`)
		case "notifications/initialized":
			if r.Header.Get(mcpHeaderSessionID) == "session-1" {
				sawSession.Store(true)
			}
			w.WriteHeader(http.StatusAccepted)
		case "tools/call":
			if r.Header.Get(mcpHeaderSessionID) == "session-1" {
				sawSession.Store(true)
			}
			toolReqCh <- req
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = io.WriteString(w, `data: {"jsonrpc":"2.0","id":2,"result":{"structuredContent":{"response":{"response_markdown":"Panel looks good."}}}}`+"\n\n")
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	srvURL, err := url.Parse(srv.URL)
	require.NoError(t, err)
	cfg := setting.NewCfg()
	cfg.AppURL = "https://grafana.example/"
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigEnabled).SetValue("true")
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigAllowedHosts).SetValue(srvURL.Host)
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigOuterAuth).SetValue("outer-token")
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigOuterAuthHeader).SetValue(outerHeader)
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigSessionTokenHeader).SetValue(secretHeader)
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigToolName).SetValue("demo_tool")
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigToolArgsJSON).SetValue(`{"context":"demo"}`)
	s.dispatcher = newWebhookDispatcher(cfg, log.New("pulse.test"))

	hook, err := s.CreateHook(ctx, CreateHookCommand{
		OrgID:     1,
		CreatedBy: 7,
		Name:      "Remote Brain",
		Type:      HookTypeMCP,
		URL:       srv.URL,
		Secret:    "test-token",
	})
	require.NoError(t, err)

	body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[` +
		`{"type":"text","text":"migrate this panel "},{"type":"mention","mention":{"kind":"webhook","targetId":"` + hook.UID + `","displayName":"Remote Brain"}}]}]}}`)
	res, err := s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "dash1", PanelID: ptr(int64(7)), Title: "demo", Body: body,
	})
	require.NoError(t, err)
	s.dispatcher.wait()

	require.Equal(t, "Bearer outer-token", gotAuth.Load())
	require.Equal(t, "Bearer outer-token", gotOuterHeader.Load())
	require.Equal(t, "test-token", gotSecretHeader.Load())
	require.True(t, sawSession.Load())
	require.Equal(t, int32(3), calls.Load())

	var toolReq map[string]any
	select {
	case toolReq = <-toolReqCh:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for MCP tool call")
	}
	params, ok := toolReq["params"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "demo_tool", params["name"])
	args, ok := params["arguments"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "demo", args["context"])
	require.Equal(t, "auto", args["specialist"])
	question, ok := args["question"].(string)
	require.True(t, ok)
	require.Contains(t, question, "Panel ID: 7")
	require.Contains(t, question, "migrate this panel")
	require.NotContains(t, question, "@Remote Brain")

	page, err := s.ListPulses(ctx, ListPulsesQuery{OrgID: 1, ThreadUID: res.Thread.UID})
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	require.Equal(t, AuthorKindServiceAccount, page.Items[1].AuthorKind)
	require.Equal(t, AssistantAuthorUserID, page.Items[1].AuthorUserID)
	require.Equal(t, res.Pulse.UID, page.Items[1].ParentUID)
	require.NotContains(t, page.Items[1].BodyText, "Remote Brain")
	require.Contains(t, page.Items[1].BodyText, "Panel looks good.")
	s.populateAuthorDisplay(ctx, page.Items)
	require.Equal(t, "Remote Brain", page.Items[1].AuthorName)
}

func TestIntegrationPulseHooks_MCPGreetingPostsLocalAck(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)
	s.features = featuremgmt.WithFeatures(featuremgmt.FlagDashboardPulseAssistant)

	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	srvURL, err := url.Parse(srv.URL)
	require.NoError(t, err)
	cfg := setting.NewCfg()
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigEnabled).SetValue("true")
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigAllowedHosts).SetValue(srvURL.Host)
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigToolName).SetValue("demo_tool")
	s.dispatcher = newWebhookDispatcher(cfg, log.New("pulse.test"))

	hook, err := s.CreateHook(ctx, CreateHookCommand{
		OrgID:     1,
		CreatedBy: 7,
		Name:      "Remote Brain",
		Type:      HookTypeMCP,
		URL:       srv.URL,
		Secret:    "test-token",
	})
	require.NoError(t, err)

	body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[` +
		`{"type":"mention","mention":{"kind":"webhook","targetId":"` + hook.UID + `","displayName":"Remote Brain"}},{"type":"text","text":" hello"}]}]}}`)
	res, err := s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "dash1", Title: "demo", Body: body,
	})
	require.NoError(t, err)
	s.dispatcher.wait()

	require.Equal(t, int32(0), calls.Load())

	page, err := s.ListPulses(ctx, ListPulsesQuery{OrgID: 1, ThreadUID: res.Thread.UID})
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	require.Equal(t, AuthorKindServiceAccount, page.Items[1].AuthorKind)
	require.NotContains(t, page.Items[1].BodyText, "Remote Brain")
	require.Contains(t, page.Items[1].BodyText, "Remote MCP hook is online")
	s.populateAuthorDisplay(ctx, page.Items)
	require.Equal(t, "Remote Brain", page.Items[1].AuthorName)
}

func TestIntegrationPulseHooks_AgentPostsRemoteReply(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)
	s.features = featuremgmt.WithFeatures(featuremgmt.FlagDashboardPulseAssistant)

	var gotAuthHeader atomic.Value
	var gotSignature atomic.Value
	requestCh := make(chan agentHookRequest, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuthHeader.Store(r.Header.Get("X-Test-Agent-Token"))
		gotSignature.Store(r.Header.Get(headerSignature))

		var req agentHookRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		requestCh <- req
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"markdown":"Yep, I can help from the remote agent layer."}`)
	}))
	defer srv.Close()

	srvURL, err := url.Parse(srv.URL)
	require.NoError(t, err)
	cfg := setting.NewCfg()
	cfg.AppURL = "https://grafana.example/"
	cfg.Raw.Section(agentConfigSection).Key(agentConfigEnabled).SetValue("true")
	cfg.Raw.Section(agentConfigSection).Key(agentConfigAllowedHosts).SetValue(srvURL.Host)
	cfg.Raw.Section(agentConfigSection).Key(agentConfigAuthHeader).SetValue("X-Test-Agent-Token")
	s.dispatcher = newWebhookDispatcher(cfg, log.New("pulse.test"))

	hook, err := s.CreateHook(ctx, CreateHookCommand{
		OrgID:     1,
		CreatedBy: 7,
		Name:      "Remote Brain",
		Type:      HookTypeAgent,
		URL:       srv.URL,
		Secret:    "agent-token",
	})
	require.NoError(t, err)

	body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[` +
		`{"type":"mention","mention":{"kind":"webhook","targetId":"` + hook.UID + `","displayName":"Remote Brain"}},{"type":"text","text":" hello can you inspect this panel?"}]}]}}`)
	res, err := s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "dash1", PanelID: ptr(int64(3)), Title: "demo", Body: body,
	})
	require.NoError(t, err)
	s.dispatcher.wait()

	require.Equal(t, "agent-token", gotAuthHeader.Load())
	require.NotEmpty(t, gotSignature.Load())

	var req agentHookRequest
	select {
	case req = <-requestCh:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for agent request")
	}
	require.Equal(t, WebhookPayloadVersion, req.Version)
	require.Equal(t, EventThreadCreated, req.Event)
	require.Equal(t, "dash1", req.Payload.Resource.UID)
	require.Contains(t, req.Prompt, "Panel ID: 3")
	require.Contains(t, req.Prompt, "hello can you inspect this panel?")
	require.NotContains(t, req.Prompt, "@Remote Brain")

	page, err := s.ListPulses(ctx, ListPulsesQuery{OrgID: 1, ThreadUID: res.Thread.UID})
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	require.Equal(t, AuthorKindServiceAccount, page.Items[1].AuthorKind)
	require.Equal(t, AssistantAuthorUserID, page.Items[1].AuthorUserID)
	require.Equal(t, res.Pulse.UID, page.Items[1].ParentUID)
	require.NotContains(t, page.Items[1].BodyText, "Remote Brain")
	require.Contains(t, page.Items[1].BodyText, "remote agent layer")
	s.populateAuthorDisplay(ctx, page.Items)
	require.Equal(t, "Remote Brain", page.Items[1].AuthorName)
}

func TestMCPHookHelpers(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigEnabled).SetValue("true")
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigAllowedHosts).SetValue("api.example.com, https://tools.example.com:8443")
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigOuterAuthHeader).SetValue("X-Outer")
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigSessionTokenHeader).SetValue("X-Secret")
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigToolName).SetValue("demo_tool")
	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigToolArgsJSON).SetValue(`{"context":"demo"}`)

	got, err := loadMCPHookConfig(cfg)
	require.NoError(t, err)
	require.True(t, got.Enabled)
	require.Equal(t, "X-Outer", got.OuterHeader)
	require.Equal(t, "X-Secret", got.SecretHeader)
	require.Equal(t, "demo_tool", got.ToolName)
	require.Equal(t, "demo", got.ToolArgs["context"])
	require.True(t, mcpURLAllowed("https://api.example.com/mcp", got.AllowedHosts))
	require.True(t, mcpURLAllowed("https://tools.example.com:8443/mcp", got.AllowedHosts))
	require.False(t, mcpURLAllowed("https://tools.example.com/mcp", got.AllowedHosts))
	require.False(t, mcpURLAllowed("https://api.example.com.evil/mcp", got.AllowedHosts))
	require.False(t, mcpURLAllowed("https://evil.example.com/mcp", []string{"*"}))

	result := json.RawMessage(`{"structuredContent":{"response":{"response_markdown":"**done**"}}}`)
	require.Equal(t, "**done**", extractMCPReplyText(result))

	sse, err := lastSSEData([]byte("event: message\n" + `data: {"ok":true}` + "\n\n"))
	require.NoError(t, err)
	require.JSONEq(t, `{"ok":true}`, sse)

	require.Equal(t, "hello", cleanMCPUserRequest("`@Remote Brain` hello", "Remote Brain"))
	require.True(t, isMCPGreetingRequest("hello"))
	require.True(t, isMCPGreetingRequest(""))
	require.False(t, isMCPGreetingRequest("can you inspect this panel?"))

	cfg.Raw.Section(mcpConfigSection).Key(mcpConfigOuterAuthHeader).SetValue("bad header")
	_, err = loadMCPHookConfig(cfg)
	require.Error(t, err)
}

func TestAgentHookHelpers(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Raw.Section(agentConfigSection).Key(agentConfigEnabled).SetValue("true")
	cfg.Raw.Section(agentConfigSection).Key(agentConfigAllowedHosts).SetValue("agent.example.com")
	cfg.Raw.Section(agentConfigSection).Key(agentConfigAuthHeader).SetValue("X-Agent-Secret")

	got, err := loadAgentHookConfig(cfg)
	require.NoError(t, err)
	require.True(t, got.Enabled)
	require.Equal(t, "X-Agent-Secret", got.AuthHeader)
	require.True(t, mcpURLAllowed("https://agent.example.com/pulse/chat", got.AllowedHosts))
	require.False(t, mcpURLAllowed("https://evil.example.com/pulse/chat", got.AllowedHosts))

	text, err := decodeAgentReply("application/json", []byte(`{"response":{"final_answer":"done"}}`))
	require.NoError(t, err)
	require.Equal(t, "done", text)
	text, err = decodeAgentReply("text/plain", []byte("plain done"))
	require.NoError(t, err)
	require.Equal(t, "plain done", text)

	header := http.Header{}
	setAgentAuthHeader(header, "", "token")
	require.Equal(t, "Bearer token", header.Get("Authorization"))
	setAgentAuthHeader(header, "X-Agent-Secret", "token")
	require.Equal(t, "token", header.Get("X-Agent-Secret"))

	cfg.Raw.Section(agentConfigSection).Key(agentConfigAuthHeader).SetValue("bad header")
	_, err = loadAgentHookConfig(cfg)
	require.Error(t, err)
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
