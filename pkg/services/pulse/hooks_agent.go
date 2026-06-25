package pulse

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

const (
	agentDispatchTimeout = 120 * time.Second
	agentMaxResponseSize = 1024 * 1024
	agentMaxReplyRunes   = 6000

	agentConfigSection      = "pulse"
	agentConfigEnabled      = "remote_agent_enabled"
	agentConfigAllowedHosts = "remote_agent_allowed_hosts"
	agentConfigAuthHeader   = "remote_agent_auth_header"
)

type agentHookConfig struct {
	Enabled      bool
	AllowedHosts []string
	AuthHeader   string
}

type agentHookRequest struct {
	Version string         `json:"version"`
	Event   EventAction    `json:"event"`
	Prompt  string         `json:"prompt"`
	Payload WebhookPayload `json:"payload"`
}

type agentReplyWriter func(ctx context.Context, markdown string) error

func (s *PulseService) dispatchAgentHook(hook Hook, payload WebhookPayload) {
	if s.dispatcher == nil {
		return
	}
	s.dispatcher.dispatchAgent(hook, payload, func(ctx context.Context, markdown string) error {
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

func (d *webhookDispatcher) dispatchAgent(hook Hook, payload WebhookPayload, writeReply agentReplyWriter) {
	cfg, err := loadAgentHookConfig(d.cfg)
	if err != nil {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultDropped).Inc()
		d.log.Warn("invalid pulse agent hook config", "err", err, "hookUID", hook.UID, "hookName", hook.Name)
		return
	}
	if !cfg.Enabled {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultDropped).Inc()
		d.log.Debug("pulse agent hook skipped because remote agent is disabled", "hookUID", hook.UID, "hookName", hook.Name)
		return
	}
	if !mcpURLAllowed(hook.URL, cfg.AllowedHosts) {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultDropped).Inc()
		d.log.Warn("pulse agent hook URL is not in the remote agent allowlist", "hookUID", hook.UID, "hookName", hook.Name)
		return
	}
	if strings.TrimSpace(hook.Secret) == "" {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultDropped).Inc()
		d.log.Warn("pulse agent hook skipped because no bearer token is configured", "hookUID", hook.UID, "hookName", hook.Name)
		return
	}

	d.wg.Add(1)
	go func() {
		defer d.wg.Done()
		d.sendAgent(hook, payload, cfg, writeReply)
	}()
}

func (d *webhookDispatcher) sendAgent(hook Hook, payload WebhookPayload, cfg agentHookConfig, writeReply agentReplyWriter) {
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), agentDispatchTimeout)
	defer cancel()

	reply, err := d.callAgent(ctx, hook, payload, cfg)
	dur := time.Since(start).Seconds()
	hookDispatchDuration.WithLabelValues(string(hook.Type)).Observe(dur)
	if err != nil {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultError).Inc()
		d.log.Warn("pulse agent hook dispatch failed", "err", err, "hookUID", hook.UID, "hookName", hook.Name, "durationSeconds", dur)
		return
	}

	replyCtx, replyCancel := context.WithTimeout(context.Background(), hookDispatchTimeout)
	defer replyCancel()
	if err := writeReply(replyCtx, formatAgentAssistantReply(hook, reply)); err != nil {
		hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultError).Inc()
		d.log.Warn("pulse agent hook could not post assistant reply", "err", err, "hookUID", hook.UID, "hookName", hook.Name, "durationSeconds", dur)
		return
	}

	hookDispatchTotal.WithLabelValues(string(hook.Type), hookResultSuccess).Inc()
	d.log.Info("pulse agent hook dispatched", "hookUID", hook.UID, "hookName", hook.Name, "durationSeconds", dur)
}

func (d *webhookDispatcher) callAgent(ctx context.Context, hook Hook, payload WebhookPayload, cfg agentHookConfig) (string, error) {
	body, err := json.Marshal(agentHookRequest{
		Version: WebhookPayloadVersion,
		Event:   payload.Event,
		Prompt:  buildAgentPrompt(payload),
		Payload: payload,
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, hook.URL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/plain")
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set(headerEvent, string(payload.Event))
	req.Header.Set(headerHookUID, hook.UID)
	req.Header.Set(headerSignature, "sha256="+signPayload(hook.Secret, body))
	setAgentAuthHeader(req.Header, cfg.AuthHeader, hook.Secret)

	client := d.client
	if d.agentClient != nil {
		client = d.agentClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, agentMaxResponseSize+1))
	if err != nil {
		return "", err
	}
	if len(bodyBytes) > agentMaxResponseSize {
		return "", fmt.Errorf("remote agent response exceeded %d bytes", agentMaxResponseSize)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("remote agent returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}
	return decodeAgentReply(resp.Header.Get("Content-Type"), bodyBytes)
}

func loadAgentHookConfig(cfg *setting.Cfg) (agentHookConfig, error) {
	if cfg == nil || cfg.Raw == nil {
		return agentHookConfig{}, nil
	}
	section := cfg.Raw.Section(agentConfigSection)
	authHeader, err := parseMCPHeaderConfig(section.Key(agentConfigAuthHeader).String(), agentConfigAuthHeader)
	if err != nil {
		return agentHookConfig{}, err
	}
	return agentHookConfig{
		Enabled:      section.Key(agentConfigEnabled).MustBool(false),
		AllowedHosts: splitMCPConfigList(section.Key(agentConfigAllowedHosts).String()),
		AuthHeader:   authHeader,
	}, nil
}

func setAgentAuthHeader(header http.Header, configuredHeader string, secret string) {
	configuredHeader = strings.TrimSpace(configuredHeader)
	if configuredHeader == "" || strings.EqualFold(configuredHeader, "Authorization") {
		header.Set("Authorization", "Bearer "+strings.TrimSpace(secret))
		return
	}
	header.Set(configuredHeader, strings.TrimSpace(secret))
}

func buildAgentPrompt(payload WebhookPayload) string {
	lines := []string{
		"Grafana Pulse triggered a remote agent hook.",
		fmt.Sprintf("Event: %s", payload.Event),
		fmt.Sprintf("Resource: %s uid=%s", payload.Resource.Kind, payload.Resource.UID),
	}
	if payload.Resource.PanelID != nil {
		lines = append(lines, fmt.Sprintf("Panel ID: %d", *payload.Resource.PanelID))
	}
	if strings.TrimSpace(payload.Resource.URL) != "" {
		lines = append(lines, "Resource URL: "+strings.TrimSpace(payload.Resource.URL))
	}
	lines = append(lines, fmt.Sprintf("Thread: %s", payload.Thread.UID))
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

func decodeAgentReply(contentType string, body []byte) (string, error) {
	body = bytes.TrimSpace(body)
	if len(body) == 0 {
		return "", errors.New("remote agent returned an empty response")
	}
	if !strings.Contains(strings.ToLower(contentType), "json") {
		return strings.TrimSpace(string(body)), nil
	}
	var root map[string]any
	if err := json.Unmarshal(body, &root); err != nil {
		return "", err
	}
	for _, key := range []string{"markdown", "response_markdown", "reply", "text", "answer"} {
		if text, ok := root[key].(string); ok && strings.TrimSpace(text) != "" {
			return strings.TrimSpace(text), nil
		}
	}
	if response, ok := root["response"].(map[string]any); ok {
		for _, key := range []string{"markdown", "response_markdown", "reply", "text", "answer", "final_answer"} {
			if text, ok := response[key].(string); ok && strings.TrimSpace(text) != "" {
				return strings.TrimSpace(text), nil
			}
		}
	}
	return "", errors.New("remote agent response did not include markdown text")
}

func formatAgentAssistantReply(_ Hook, reply string) string {
	reply = truncateAgentReply(strings.TrimSpace(reply))
	if reply == "" {
		reply = "The remote agent completed, but did not return any text."
	}
	return reply
}

func truncateAgentReply(reply string) string {
	runes := []rune(reply)
	if len(runes) <= agentMaxReplyRunes {
		return reply
	}
	return strings.TrimSpace(string(runes[:agentMaxReplyRunes])) + "\n\n_Response truncated._"
}
