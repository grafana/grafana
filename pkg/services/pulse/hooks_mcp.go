package pulse

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

const (
	mcpDispatchTimeout = 30 * time.Second
	mcpProtocolVersion = "2025-06-18"
	mcpMaxResponseSize = 1024 * 1024
	mcpMaxReplyRunes   = 6000

	mcpHeaderSessionID = "Mcp-Session-Id"

	mcpConfigSection            = "pulse"
	mcpConfigEnabled            = "remote_mcp_enabled"
	mcpConfigAllowedHosts       = "remote_mcp_allowed_hosts"
	mcpConfigOuterAuth          = "remote_mcp_outer_auth_token"
	mcpConfigOuterAuthHeader    = "remote_mcp_outer_auth_header"
	mcpConfigSessionTokenHeader = "remote_mcp_session_token_header"
	mcpConfigToolName           = "remote_mcp_tool_name"
	mcpConfigToolArgsJSON       = "remote_mcp_tool_args_json"
)

type mcpHookConfig struct {
	Enabled      bool
	AllowedHosts []string
	OuterAuth    string
	OuterHeader  string
	SecretHeader string
	ToolName     string
	ToolArgs     map[string]any
}

type mcpRPCRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      any    `json:"id,omitempty"`
	Method  string `json:"method"`
	Params  any    `json:"params,omitempty"`
}

type mcpRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *mcpRPCError    `json:"error,omitempty"`
}

type mcpRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type mcpReplyWriter func(ctx context.Context, markdown string) error

func (s *PulseService) dispatchMCPHook(hook Hook, payload WebhookPayload) {
	if s.dispatcher == nil {
		return
	}
	s.dispatcher.dispatchMCP(hook, payload, func(ctx context.Context, markdown string) error {
		_, err := s.AddAssistantReply(ctx, AddAssistantReplyCommand{
			OrgID:      payload.OrgID,
			ThreadUID:  payload.Thread.UID,
			ParentUID:  payload.Pulse.UID,
			Markdown:   markdown,
			AuthorName: strings.TrimSpace(hook.Name),
		})
		return err
	})
}

func (d *webhookDispatcher) dispatchMCP(hook Hook, payload WebhookPayload, writeReply mcpReplyWriter) {
	cfg, err := loadMCPHookConfig(d.cfg)
	if err != nil {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultDropped).Inc()
		d.log.Warn("invalid pulse MCP hook config", "err", err, "hookUID", hook.UID, "hookName", hook.Name)
		return
	}
	if !cfg.Enabled {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultDropped).Inc()
		d.log.Debug("pulse MCP hook skipped because remote MCP is disabled", "hookUID", hook.UID, "hookName", hook.Name)
		return
	}
	if cfg.ToolName == "" {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultDropped).Inc()
		d.log.Warn("pulse MCP hook skipped because no remote MCP tool is configured", "hookUID", hook.UID, "hookName", hook.Name)
		return
	}
	if !mcpURLAllowed(hook.URL, cfg.AllowedHosts) {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultDropped).Inc()
		d.log.Warn("pulse MCP hook URL is not in the remote MCP allowlist", "hookUID", hook.UID, "hookName", hook.Name)
		return
	}
	if strings.TrimSpace(hook.Secret) == "" {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultDropped).Inc()
		d.log.Warn("pulse MCP hook skipped because no bearer token is configured", "hookUID", hook.UID, "hookName", hook.Name)
		return
	}

	d.wg.Add(1)
	go func() {
		defer d.wg.Done()
		d.sendMCP(hook, payload, cfg, writeReply)
	}()
}

func (d *webhookDispatcher) sendMCP(hook Hook, payload WebhookPayload, cfg mcpHookConfig, writeReply mcpReplyWriter) {
	start := time.Now()

	reply := ""
	var err error
	userRequest := cleanMCPUserRequest(payload.Pulse.BodyText, hook.Name)
	if isMCPGreetingRequest(userRequest) {
		reply = "Remote MCP hook is online. Send a panel, migration, or investigation request when you are ready."
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), mcpDispatchTimeout)
		defer cancel()
		reply, err = d.callMCPTool(ctx, hook, payload, cfg)
	}
	dur := time.Since(start).Seconds()
	hookDispatchDuration.WithLabelValues(string(hook.Type)).Observe(dur)
	if err != nil {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultError).Inc()
		d.log.Warn("pulse MCP hook dispatch failed", "err", err, "hookUID", hook.UID, "hookName", hook.Name, "durationSeconds", dur)
		return
	}

	replyCtx, replyCancel := context.WithTimeout(context.Background(), hookDispatchTimeout)
	defer replyCancel()
	if err := writeReply(replyCtx, formatMCPAssistantReply(hook, reply)); err != nil {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultError).Inc()
		d.log.Warn("pulse MCP hook could not post assistant reply", "err", err, "hookUID", hook.UID, "hookName", hook.Name, "durationSeconds", dur)
		return
	}

	hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultSuccess).Inc()
	d.log.Info("pulse MCP hook dispatched", "hookUID", hook.UID, "hookName", hook.Name, "durationSeconds", dur)
}

func (d *webhookDispatcher) callMCPTool(ctx context.Context, hook Hook, payload WebhookPayload, cfg mcpHookConfig) (string, error) {
	sessionID := ""
	_, err := d.postMCP(ctx, hook, cfg, &sessionID, mcpRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "initialize",
		Params: map[string]any{
			"protocolVersion": mcpProtocolVersion,
			"capabilities":    map[string]any{},
			"clientInfo": map[string]any{
				"name":    "grafana-pulse",
				"version": "hackathon",
			},
		},
	}, false)
	if err != nil {
		return "", err
	}

	_, _ = d.postMCP(ctx, hook, cfg, &sessionID, mcpRPCRequest{
		JSONRPC: "2.0",
		Method:  "notifications/initialized",
	}, true)

	args := make(map[string]any, len(cfg.ToolArgs)+2)
	for k, v := range cfg.ToolArgs {
		args[k] = v
	}
	args["question"] = buildMCPQuestion(payload)
	args["specialist"] = "auto"

	resp, err := d.postMCP(ctx, hook, cfg, &sessionID, mcpRPCRequest{
		JSONRPC: "2.0",
		ID:      2,
		Method:  "tools/call",
		Params: map[string]any{
			"name":      cfg.ToolName,
			"arguments": args,
		},
	}, false)
	if err != nil {
		return "", err
	}
	return extractMCPReplyText(resp.Result), nil
}

func (d *webhookDispatcher) postMCP(ctx context.Context, hook Hook, cfg mcpHookConfig, sessionID *string, rpc mcpRPCRequest, allowEmpty bool) (mcpRPCResponse, error) {
	body, err := json.Marshal(rpc)
	if err != nil {
		return mcpRPCResponse{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, hook.URL, bytes.NewReader(body))
	if err != nil {
		return mcpRPCResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("User-Agent", userAgent)
	sessionToken := strings.TrimSpace(hook.Secret)
	if cfg.OuterAuth != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.OuterAuth)
		if cfg.OuterHeader != "" {
			req.Header.Set(cfg.OuterHeader, "Bearer "+cfg.OuterAuth)
		}
		if cfg.SecretHeader != "" {
			req.Header.Set(cfg.SecretHeader, sessionToken)
		}
	} else {
		req.Header.Set("Authorization", "Bearer "+sessionToken)
	}
	if sessionID != nil && strings.TrimSpace(*sessionID) != "" {
		req.Header.Set(mcpHeaderSessionID, strings.TrimSpace(*sessionID))
	}

	client := d.client
	if d.mcpClient != nil {
		client = d.mcpClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return mcpRPCResponse{}, err
	}
	defer resp.Body.Close()

	if sessionID != nil && strings.TrimSpace(resp.Header.Get(mcpHeaderSessionID)) != "" {
		*sessionID = strings.TrimSpace(resp.Header.Get(mcpHeaderSessionID))
	}

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, mcpMaxResponseSize+1))
	if err != nil {
		return mcpRPCResponse{}, err
	}
	if len(bodyBytes) > mcpMaxResponseSize {
		return mcpRPCResponse{}, fmt.Errorf("remote MCP response exceeded %d bytes", mcpMaxResponseSize)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return mcpRPCResponse{}, fmt.Errorf("remote MCP returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}

	return decodeMCPResponse(resp.Header.Get("Content-Type"), bodyBytes, allowEmpty)
}

func loadMCPHookConfig(cfg *setting.Cfg) (mcpHookConfig, error) {
	if cfg == nil || cfg.Raw == nil {
		return mcpHookConfig{}, nil
	}
	section := cfg.Raw.Section(mcpConfigSection)
	outerHeader, err := parseMCPHeaderConfig(section.Key(mcpConfigOuterAuthHeader).String(), mcpConfigOuterAuthHeader)
	if err != nil {
		return mcpHookConfig{}, err
	}
	secretHeader, err := parseMCPHeaderConfig(section.Key(mcpConfigSessionTokenHeader).String(), mcpConfigSessionTokenHeader)
	if err != nil {
		return mcpHookConfig{}, err
	}

	out := mcpHookConfig{
		Enabled:      section.Key(mcpConfigEnabled).MustBool(false),
		AllowedHosts: splitMCPConfigList(section.Key(mcpConfigAllowedHosts).String()),
		OuterAuth:    strings.TrimSpace(section.Key(mcpConfigOuterAuth).String()),
		OuterHeader:  outerHeader,
		SecretHeader: secretHeader,
		ToolName:     strings.TrimSpace(section.Key(mcpConfigToolName).String()),
		ToolArgs:     map[string]any{},
	}
	rawArgs := strings.TrimSpace(section.Key(mcpConfigToolArgsJSON).String())
	if rawArgs == "" {
		return out, nil
	}
	if err := json.Unmarshal([]byte(rawArgs), &out.ToolArgs); err != nil {
		return out, fmt.Errorf("%s must be a JSON object: %w", mcpConfigToolArgsJSON, err)
	}
	if out.ToolArgs == nil {
		out.ToolArgs = map[string]any{}
	}
	return out, nil
}

func parseMCPHeaderConfig(raw string, key string) (string, error) {
	header := strings.TrimSpace(raw)
	if header == "" {
		return "", nil
	}
	for _, r := range header {
		if r <= 31 || r == 127 || r > 127 || strings.ContainsRune("()<>@,;:\\\"/[]?={} \t\r\n", r) {
			return "", fmt.Errorf("%s must be a valid HTTP header name", key)
		}
	}
	return header, nil
}

func splitMCPConfigList(raw string) []string {
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\t' || r == ' '
	})
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func mcpURLAllowed(rawURL string, allowedHosts []string) bool {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || u.Host == "" {
		return false
	}
	endpointHost := strings.ToLower(u.Host)
	endpointHostname := strings.ToLower(u.Hostname())
	for _, rawAllowed := range allowedHosts {
		allowedHost, allowedHostname := normalizeMCPAllowedHost(rawAllowed)
		if allowedHost == "" || strings.Contains(allowedHost, "*") {
			continue
		}
		if endpointHost == allowedHost {
			return true
		}
		if !strings.Contains(allowedHost, ":") && endpointHostname == allowedHostname {
			return true
		}
	}
	return false
}

func normalizeMCPAllowedHost(raw string) (string, string) {
	raw = strings.TrimSpace(strings.TrimSuffix(raw, "/"))
	if raw == "" {
		return "", ""
	}
	if strings.Contains(raw, "://") {
		u, err := url.Parse(raw)
		if err != nil {
			return "", ""
		}
		return strings.ToLower(u.Host), strings.ToLower(u.Hostname())
	}
	if strings.Contains(raw, "/") {
		return "", ""
	}
	host := strings.ToLower(raw)
	hostname := strings.Trim(host, "[]")
	if h, _, err := net.SplitHostPort(raw); err == nil {
		hostname = strings.ToLower(strings.Trim(h, "[]"))
	}
	return host, hostname
}

func decodeMCPResponse(contentType string, body []byte, allowEmpty bool) (mcpRPCResponse, error) {
	body = bytes.TrimSpace(body)
	if len(body) == 0 {
		if allowEmpty {
			return mcpRPCResponse{}, nil
		}
		return mcpRPCResponse{}, errors.New("remote MCP returned an empty response")
	}
	if strings.Contains(strings.ToLower(contentType), "text/event-stream") {
		data, err := lastSSEData(body)
		if err != nil {
			return mcpRPCResponse{}, err
		}
		body = []byte(data)
	}

	var out mcpRPCResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return mcpRPCResponse{}, err
	}
	if out.Error != nil {
		return out, fmt.Errorf("remote MCP JSON-RPC error %d: %s", out.Error.Code, out.Error.Message)
	}
	return out, nil
}

func lastSSEData(body []byte) (string, error) {
	scanner := bufio.NewScanner(bytes.NewReader(body))
	scanner.Buffer(make([]byte, 0, 1024), mcpMaxResponseSize)

	var current []string
	last := ""
	flush := func() {
		if len(current) == 0 {
			return
		}
		data := strings.TrimSpace(strings.Join(current, "\n"))
		current = nil
		if data != "" && data != "[DONE]" {
			last = data
		}
	}

	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			flush()
			continue
		}
		if strings.HasPrefix(line, "data:") {
			current = append(current, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
	flush()
	if err := scanner.Err(); err != nil {
		return "", err
	}
	if last == "" {
		return "", errors.New("remote MCP SSE response did not include data")
	}
	return last, nil
}

func buildMCPQuestion(payload WebhookPayload) string {
	lines := []string{
		"Grafana Pulse triggered a remote MCP hook.",
		fmt.Sprintf("Event: %s", payload.Event),
		fmt.Sprintf("Hook type: %s", payload.Hook.Type),
		fmt.Sprintf("Resource: %s uid=%s", payload.Resource.Kind, payload.Resource.UID),
	}
	if payload.Resource.PanelID != nil {
		lines = append(lines, fmt.Sprintf("Panel ID: %d", *payload.Resource.PanelID))
	}
	if strings.TrimSpace(payload.Resource.URL) != "" {
		lines = append(lines, "Resource URL: "+strings.TrimSpace(payload.Resource.URL))
	}
	lines = append(lines,
		fmt.Sprintf("Thread: %s", payload.Thread.UID),
	)
	if strings.TrimSpace(payload.Thread.Title) != "" {
		lines = append(lines, "Thread title: "+strings.TrimSpace(payload.Thread.Title))
	}
	lines = append(lines, fmt.Sprintf("Pulse: %s", payload.Pulse.UID))
	if strings.TrimSpace(payload.Pulse.ParentUID) != "" {
		lines = append(lines, "Parent pulse: "+strings.TrimSpace(payload.Pulse.ParentUID))
	}
	body := cleanMCPUserRequest(payload.Pulse.BodyText, payload.Hook.Name)
	if body == "" {
		body = "(no text body)"
	}
	lines = append(lines,
		"",
		"User request:",
		body,
		"",
		"The triggering @hook mention has been removed from the user request. Do not treat the hook name or mention text as a query.",
		"Return a concise Markdown reply that can be posted back into the same Pulse thread.",
	)
	return strings.Join(lines, "\n")
}

func cleanMCPUserRequest(bodyText string, hookName string) string {
	body := strings.TrimSpace(bodyText)
	hookName = strings.TrimSpace(hookName)
	if body == "" || hookName == "" {
		return body
	}
	mention := "@" + hookName
	replacements := []string{
		"`" + mention + "`",
		mention,
	}
	for _, replacement := range replacements {
		body = strings.ReplaceAll(body, replacement, "")
	}
	return strings.Trim(strings.TrimSpace(body), " \t\r\n:,-")
}

func isMCPGreetingRequest(request string) bool {
	request = strings.ToLower(strings.Trim(strings.TrimSpace(request), " \t\r\n.!?,:;-"))
	if request == "" {
		return true
	}
	switch request {
	case "hi", "hello", "hey", "yo", "test", "ping", "hi there", "hello there":
		return true
	default:
		return false
	}
}

func extractMCPReplyText(result json.RawMessage) string {
	if len(bytes.TrimSpace(result)) == 0 {
		return ""
	}
	var root map[string]any
	if err := json.Unmarshal(result, &root); err != nil {
		var text string
		if json.Unmarshal(result, &text) == nil {
			return strings.TrimSpace(text)
		}
		return ""
	}

	paths := [][]string{
		{"structuredContent", "response", "response_markdown"},
		{"structuredContent", "response", "answer"},
		{"structuredContent", "response", "summary"},
		{"structuredContent", "response", "final_answer"},
		{"structuredContent", "response_markdown"},
		{"structuredContent", "answer"},
		{"structuredContent", "summary"},
		{"structuredContent", "final_answer"},
		{"response", "response_markdown"},
		{"response", "answer"},
		{"response", "summary"},
		{"response", "final_answer"},
		{"response_markdown"},
		{"answer"},
		{"summary"},
		{"final_answer"},
	}
	for _, path := range paths {
		if text := lookupMCPString(root, path...); text != "" {
			return text
		}
	}
	if text := mcpContentText(root["content"]); text != "" {
		return text
	}
	if structured, ok := root["structuredContent"].(map[string]any); ok {
		if text := mcpContentText(structured["content"]); text != "" {
			return text
		}
	}
	return ""
}

func lookupMCPString(root map[string]any, path ...string) string {
	var cur any = root
	for i, part := range path {
		m, ok := cur.(map[string]any)
		if !ok {
			return ""
		}
		next, ok := m[part]
		if !ok {
			return ""
		}
		if i == len(path)-1 {
			text, ok := next.(string)
			if !ok {
				return ""
			}
			return strings.TrimSpace(text)
		}
		cur = next
	}
	return ""
}

func mcpContentText(v any) string {
	items, ok := v.([]any)
	if !ok {
		return ""
	}
	parts := make([]string, 0, len(items))
	for _, item := range items {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		kind, _ := m["type"].(string)
		text, _ := m["text"].(string)
		text = strings.TrimSpace(text)
		if text != "" && (kind == "" || kind == "text") {
			parts = append(parts, text)
		}
	}
	return strings.Join(parts, "\n\n")
}

func formatMCPAssistantReply(_ Hook, reply string) string {
	reply = truncateMCPReply(strings.TrimSpace(reply))
	if reply == "" {
		reply = "The remote MCP tool completed, but did not return any text."
	}
	return reply
}

func truncateMCPReply(reply string) string {
	runes := []rune(reply)
	if len(runes) <= mcpMaxReplyRunes {
		return reply
	}
	return strings.TrimSpace(string(runes[:mcpMaxReplyRunes])) + "\n\n_Response truncated._"
}
