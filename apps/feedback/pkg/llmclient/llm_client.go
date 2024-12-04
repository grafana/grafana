package llmclient

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/klog/v2"
)

// NewGitHubClient creates a new GitHub client
func NewLLMClient(url string, config ChatOptions, cfg *setting.Cfg) (*LLMClient, error) {
	c := &LLMClient{
		URL:         url,
		ChatOptions: config,
	}
	if r, err := readAsLabelMap(cfg, "responsibilities.csv"); err != nil {
		return c, err
	} else {
		c.Responsibilities = r
	}

	if r, err := readAsLabelMap(cfg, "labels.csv"); err != nil {
		return c, err
	} else {
		c.LabelMap = r
	}

	return c, nil
}

func readAsLabelMap(cfg *setting.Cfg, filename string) (labelMap, error) {
	allowedFiles := map[string]bool{
		"responsibilities.csv": true,
		"labels.csv":           true,
	}

	if !allowedFiles[filename] {
		return nil, fmt.Errorf("file %s is not allowed", filename)
	}

	path := filepath.Join(cfg.HomePath, "apps/feedback/pkg/llmclient/"+filename)
	// nolint: gosec
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading file %s: %w", filename, err)
	}
	reader := csv.NewReader(bytes.NewReader(raw))

	// Read all rows
	rows, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("reading csv %s: %w", filename, err)
	}

	// Create a map
	dataMap := make(labelMap)
	for _, row := range rows[1:] { // Skip the header row
		dataMap[row[1]] = row[0]
	}
	return dataMap, nil
}

// CreateIssue creates an issue in the Github repository
func (c *LLMClient) PromptForLabels(userText string) (labels []string) {
	defer func() {
		if len(labels) == 0 {
			labels = append(labels, "type/unknown")
		}
	}()

	llmReq := LLMRequest{
		ChatOptions: c.ChatOptions,
		Messages: []LLMMessage{
			{
				Role: "user",
				Content: fmt.Sprintf("given the following responsibilities list:\n```%s```\n and the following mapping of responsibilities to labels:\n```%s```\n and the following user feedback: \"%s\"\n which label or labels best correlate with this issue? Only reply with the labels separated by spaces.",
					c.Responsibilities, c.LabelMap, userText),
			},
		},
	}

	// Marshal the issue struct into JSON
	payload, err := json.Marshal(llmReq)
	if err != nil {
		klog.ErrorS(err, "failed to marshal request")
		return nil
	}

	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/%s", c.URL, "api/chat"), bytes.NewBuffer(payload))
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
