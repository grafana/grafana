package llmclient

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/klog/v2"
)

// NewGitHubClient creates a new GitHub client
func NewLLMClient(url string, config ChatOptions, cfg *setting.Cfg) (*LLMClient, error) {
	c := &LLMClient{
		URL:         url,
		ChatOptions: config,
		cfg:         cfg,
	}
	if r, err := readResponsibilities(cfg); err != nil {
		return c, err
	} else {
		c.TeamResponsibilities = r
	}

	return c, nil
}

func readResponsibilities(cfg *setting.Cfg) (map[string]string, error) {
	path := filepath.Join(cfg.HomePath, TEAM_RESPONSIBILITIES_FILE)
	// nolint:gosec
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading file %s: %w", path, err)
	}
	reader := csv.NewReader(bytes.NewReader(raw))

	// Read all rows
	rows, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("reading csv %s: %w", path, err)
	}

	// Create a map of feature -> owning team
	itemMap := make(map[string]string)
	for _, row := range rows[1:] { // Skip the header row
		itemMap[row[1]] = row[0]
	}
	return itemMap, nil
}

// CreateIssue creates an issue in the Github repository
func (c *LLMClient) PromptForLabels(ctx context.Context, userText string) []string {
	path := filepath.Join(c.cfg.HomePath, TEAM_PROMPT_TEMPLATE)

	t, err := template.ParseFiles(path)
	if err != nil {
		klog.ErrorS(err, "parsing template")
		return nil
	}
	var content bytes.Buffer
	if err := t.Execute(&content, LLMTeamPromptTemplate{
		TeamResponsibilities: c.TeamResponsibilities,
		UserFeedback:         userText,
	}); err != nil {
		klog.ErrorS(err, "executing template")
		return nil
	}
	llmReq := LLMRequest{
		ChatOptions: c.ChatOptions,
		Messages: []LLMMessage{
			{
				Role:    "user",
				Content: content.String(),
			},
		},
	}

	// Marshal the issue struct into JSON
	payload, err := json.Marshal(llmReq)
	if err != nil {
		klog.ErrorS(err, "failed to marshal request")
		return nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/%s", c.URL, "api/chat"), bytes.NewBuffer(payload))
	if err != nil {
		klog.ErrorS(err, "failed to create request")
		return nil
	}

	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Accept", "*/*")

	// Send the request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		klog.ErrorS(err, "failed to send request")
		return nil
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			klog.ErrorS(err, "failed to close response body")
		}
	}()

	if resp.StatusCode > 399 {
		klog.ErrorS(fmt.Errorf("bad status code from github"), "bad status code", "status", resp.StatusCode)
		return nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		klog.ErrorS(err, "reading response")
		return nil
	}

	// Response is a mess and looks somethinglike this:
	// 0:"Looks"
	// 0:" good"
	// 0:" to"
	// 0:" me"
	// It sprinkles all sorts of extra characters throughout, but we can strip them out easily
	s := strings.ReplaceAll(string(body), "0:\"", "")
	s = strings.ReplaceAll(s, "\"", "")
	s = strings.ReplaceAll(s, "\n", "")
	tokens := strings.Split(s, " ")
	for i := 0; i < len(tokens); i++ {
		t := tokens[i]
		t = strings.TrimSpace(t)
		tokens[i] = fmt.Sprintf("team/%s", strings.TrimSuffix(t, "\""))
	}

	return tokens
}

// CreateIssue creates an issue in the Github repository
func (c *LLMClient) PromptForShortIssueTitle(ctx context.Context, userText string) (string, error) {
	path := filepath.Join(c.cfg.HomePath, ISSUE_NAME_PROMPT_TEMPLATE)

	t, err := template.ParseFiles(path)
	if err != nil {
		return "", fmt.Errorf("parsing template: %w", err)
	}
	var content bytes.Buffer
	if err := t.Execute(&content, userText); err != nil {
		return "", fmt.Errorf("executing template: %w", err)
	}
	llmReq := LLMRequest{
		ChatOptions: c.ChatOptions,
		Messages: []LLMMessage{
			{
				Role:    "user",
				Content: content.String(),
			},
		},
	}

	// Marshal the issue struct into JSON
	payload, err := json.Marshal(llmReq)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/%s", c.URL, "api/chat"), bytes.NewBuffer(payload))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Accept", "*/*")

	// Send the request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			klog.ErrorS(err, "failed to close response body")
		}
	}()

	if resp.StatusCode > 399 {
		return "", fmt.Errorf("bad status code from github: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		klog.ErrorS(err, "reading response")
	}

	// Response is a mess and looks something like this:
	// 0:"Looks"
	// 0:" good"
	// 0:" to"
	// 0:" me"
	tokens := strings.Split(string(body), "0:\"")
	for i, t := range tokens {
		t = strings.ReplaceAll(t, "\n", "")
		t = strings.ReplaceAll(t, "\\\"", "")
		t = strings.TrimSuffix(t, "\"")
		tokens[i] = t
	}

	return strings.TrimSpace(strings.Join(tokens, "")), nil
}
