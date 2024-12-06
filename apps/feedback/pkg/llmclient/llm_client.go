package llmclient

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"text/template"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

//go:embed template_team_prompt.txt
var templateTeamPrompt string

//go:embed template_issue_name_prompt.txt
var templateIssueNamePrompt string

//go:embed team_responsibilities.csv
var teamReponsibilities string

// NewLLMClient creates a new LLM client
func NewLLMClient(url string, config ChatOptions) (*LLMClient, error) {
	responsibilities, err := readTeamResponsibilities()
	if err != nil {
		return nil, err
	}

	tmplTeamPrompt, err := template.New("templateTeamPrompt").Parse(templateTeamPrompt)
	if err != nil {
		return nil, fmt.Errorf("parsing templateTeamPrompt: %w", err)
	}

	tmplIssueNamePrompt, err := template.New("templateIssueNamePrompt").Parse(templateIssueNamePrompt)
	if err != nil {
		return nil, fmt.Errorf("parsing templateIssueNamePrompt: %w", err)
	}

	return &LLMClient{
		URL:                  url,
		ChatOptions:          config,
		TeamResponsibilities: responsibilities,
		tmplTeamPrompt:       tmplTeamPrompt,
		tmplIssueNamePrompt:  tmplIssueNamePrompt,
		httpClient: &http.Client{
			Timeout: 2 * time.Minute, // TODO: how long does this usually take?
		},
	}, nil
}

func readTeamResponsibilities() (map[string]string, error) {
	reader := csv.NewReader(bytes.NewBufferString(teamReponsibilities))

	// Read all rows
	rows, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("reading csv: %w", err)
	}

	// Create a map of feature -> owning team
	itemMap := make(map[string]string)

	for _, row := range rows[1:] { // Skip the header row
		itemMap[row[1]] = row[0]
	}

	return itemMap, nil
}

// CreateIssue creates an issue in the Github repository
func (c *LLMClient) PromptForLabels(ctx context.Context, userText string) ([]string, error) {
	var content bytes.Buffer

	if err := c.tmplTeamPrompt.Execute(&content, LLMTeamPromptTemplate{
		TeamResponsibilities: c.TeamResponsibilities,
		UserFeedback:         userText,
	}); err != nil {
		return nil, fmt.Errorf("executing templateTeamPrompt: %w", err)
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
		return nil, fmt.Errorf("failed to marshal llm request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/%s", c.URL, "api/chat"), bytes.NewBuffer(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Accept", "*/*")

	// Send the request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logging.FromContext(ctx).Error("failed to close response body", "error", err.Error())
		}
	}()

	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("http response bad status code: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading http response: %w", err)
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

	return tokens, nil
}

// CreateIssue creates an issue in the Github repository
func (c *LLMClient) PromptForShortIssueTitle(ctx context.Context, userText string) (string, error) {
	var content bytes.Buffer

	if err := c.tmplIssueNamePrompt.Execute(&content, userText); err != nil {
		return "", fmt.Errorf("executing templateIssueNamePrompt: %w", err)
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
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logging.FromContext(ctx).Error("failed to close response body", "error", err.Error())
		}
	}()

	if resp.StatusCode >= http.StatusBadRequest {
		return "", fmt.Errorf("http response bad status code: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("error reading http response: %w", err)
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
