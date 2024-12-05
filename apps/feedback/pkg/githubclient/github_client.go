package githubclient

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

// GitHubClient defines a simple client for interacting with the GitHub API
type GitHubClient struct {
	httpClient *http.Client
	BaseURL    string
	Token      string
	Owner      string
	Repo       string
}

// NewGitHubClient creates a new GitHub client
func NewGitHubClient(token string, owner string, repo string) *GitHubClient {
	return &GitHubClient{
		BaseURL: "https://api.github.com",
		Token:   token,
		Owner:   owner,
		Repo:    repo,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Issue represents the payload for creating a GitHub issue
type Issue struct {
	Title  string   `json:"title"`
	Body   string   `json:"body"`
	Labels []string `json:"labels"`
}

// ImageCommit represents the payload for uploading an image into a Github repo
type ImageCommit struct {
	Message string `json:"message"`
	Content string `json:"content"`
}

// CreateIssue creates an issue in the Github repository
func (c *GitHubClient) CreateIssue(ctx context.Context, issue Issue) (string, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/issues", c.BaseURL, c.Owner, c.Repo)

	// Marshal the issue struct into JSON
	payload, err := json.Marshal(issue)
	if err != nil {
		return "", fmt.Errorf("failed to marshal issue: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(payload))
	if err != nil {
		return "", fmt.Errorf("failed creating request: %w", err)
	}

	req.Header.Add("Accept", "application/vnd.github+json")
	req.Header.Add("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", c.Token))

	// Send the request
	// TODO: Emit metrics on failures
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logging.FromContext(ctx).Error("failed to close response body", "error", err.Error())
		}
	}()

	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("failed to create issue: status %d", resp.StatusCode)
	}

	var responseObj struct {
		HTMLUrl string `json:"html_url"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&responseObj); err != nil {
		return "", fmt.Errorf("unmarshaling response: %w", err)
	}

	return responseObj.HTMLUrl, nil
}

// UploadImage uploads an image in the Github repository
func (c *GitHubClient) UploadImage(ctx context.Context, imageUuid string, imageType *string, screenshotData []byte) (string, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/contents/images/%s.png", c.BaseURL, c.Owner, c.Repo, imageUuid)

	// Build the image commit
	imageCommit := ImageCommit{
		Message: fmt.Sprintf("commit message for %s.%s", imageUuid, *imageType),
		Content: base64.StdEncoding.EncodeToString(screenshotData),
	}

	// Marshal the imageCommit struct into JSON
	payload, err := json.Marshal(imageCommit)
	if err != nil {
		return "", fmt.Errorf("failed to marshal imageCommit: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewBuffer(payload))
	if err != nil {
		return "", fmt.Errorf("failed creating request: %w", err)
	}

	req.Header.Add("Accept", "application/vnd.github+json")
	req.Header.Add("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", c.Token))

	// Send the request
	// TODO: Emit metrics on failures
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logging.FromContext(ctx).Error("failed to close response body", "error", err.Error())
		}
	}()

	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("failed to create issue: status %d", resp.StatusCode)
	}

	var responseObj struct {
		Content struct {
			Url string `json:"html_url"` // this field with ?raw=true attached lets us embed in the issue
		} `json:"content"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&responseObj); err != nil {
		return "", fmt.Errorf("unmarshaling response: %w", err)
	}

	return responseObj.Content.Url, nil
}
