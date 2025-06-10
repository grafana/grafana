package instancechecks

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/go-github/v70/github"
	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOutOfSupportVersionStep(t *testing.T) {
	now := time.Now()
	oldDate := now.AddDate(0, -16, 0)                          // 16 months ago
	recentDate := now.AddDate(0, -8, 0)                        // 8 months ago
	oldDateButSupportedIfLatestMinor := now.AddDate(0, -10, 0) // 10 months ago

	tests := []struct {
		name        string
		step        *outOfSupportVersionStep
		input       any
		wantFailure bool
		wantErr     bool
	}{
		{
			name: "should return error for invalid input type",
			step: &outOfSupportVersionStep{
				GrafanaVersion: "9.5.0",
				BuildDate:      now,
				ghClient:       &mockGitHubClient{},
			},
			input:   123, // invalid type
			wantErr: true,
		},
		{
			name: "should return nil for non-out-of-support item",
			step: &outOfSupportVersionStep{
				GrafanaVersion: "9.5.0",
				BuildDate:      now,
				ghClient:       &mockGitHubClient{},
			},
			input:       "other_item",
			wantFailure: false,
			wantErr:     false,
		},
		{
			name: "should return nil for recent build date",
			step: &outOfSupportVersionStep{
				GrafanaVersion: "11.5.0",
				BuildDate:      recentDate,
				ghClient:       &mockGitHubClient{},
			},
			input:       outOfSupportVersion,
			wantFailure: false,
			wantErr:     false,
		},
		{
			name: "should return failure for old build date",
			step: &outOfSupportVersionStep{
				GrafanaVersion: "9.5.0",
				BuildDate:      oldDate,
				ghClient:       &mockGitHubClient{},
			},
			input:       outOfSupportVersion,
			wantFailure: true,
			wantErr:     false,
		},
		{
			name: "should return nil for invalid version format",
			step: &outOfSupportVersionStep{
				GrafanaVersion: "invalid-version",
				BuildDate:      oldDateButSupportedIfLatestMinor,
				ghClient:       &mockGitHubClient{},
			},
			input:       outOfSupportVersion,
			wantFailure: false,
			wantErr:     false,
		},
		{
			name: "should return nil for GitHub API error",
			step: &outOfSupportVersionStep{
				GrafanaVersion: "9.5.0",
				BuildDate:      oldDateButSupportedIfLatestMinor,
				ghClient: &mockGitHubClient{
					errCode: http.StatusTooManyRequests,
				},
			},
			input:       outOfSupportVersion,
			wantFailure: false,
			wantErr:     false,
		},
		{
			name: "should return failure for non-latest minor version",
			step: &outOfSupportVersionStep{
				GrafanaVersion: "9.5.0",
				BuildDate:      oldDateButSupportedIfLatestMinor,
				ghClient: &mockGitHubClient{
					release: &github.RepositoryRelease{},
				},
			},
			input:       outOfSupportVersion,
			wantFailure: true,
			wantErr:     false,
		},
		{
			name: "should return nil for latest minor version",
			step: &outOfSupportVersionStep{
				GrafanaVersion: "9.5.0",
				BuildDate:      oldDateButSupportedIfLatestMinor,
				ghClient: &mockGitHubClient{
					errCode: http.StatusNotFound,
				},
			},
			input:       outOfSupportVersion,
			wantFailure: false,
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			failures, err := tt.step.Run(context.Background(), logging.DefaultLogger, &advisor.CheckSpec{}, tt.input)

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)

			if tt.wantFailure {
				require.Len(t, failures, 1)
				assert.Equal(t, advisor.CheckReportFailureSeverityHigh, failures[0].Severity)
				assert.Equal(t, outOfSupportVersion, failures[0].ItemID)
				assert.Equal(t, "Grafana version "+tt.step.GrafanaVersion+" is out of support", failures[0].Item)
			} else {
				assert.Empty(t, failures)
			}
		})
	}
}

type mockGitHubClient struct {
	release *github.RepositoryRelease
	errCode int
}

func (m *mockGitHubClient) GetReleaseByTag(ctx context.Context, owner, repo, tag string) (*github.RepositoryRelease, *github.Response, error) {
	if m.errCode != 0 {
		return nil, &github.Response{Response: &http.Response{StatusCode: m.errCode}}, assert.AnError
	}
	return m.release, &github.Response{Response: &http.Response{StatusCode: http.StatusOK}}, nil
}
