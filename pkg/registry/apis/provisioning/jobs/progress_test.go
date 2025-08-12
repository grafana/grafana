package jobs

import (
	"context"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJobProgressRecorderSetRefURLs(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Test setting RefURLs
	expectedRefURLs := &provisioning.RepositoryURLs{
		SourceURL:         "https://github.com/grafana/grafana/tree/feature-branch",
		CompareURL:        "https://github.com/grafana/grafana/compare/main...feature-branch",
		NewPullRequestURL: "https://github.com/grafana/grafana/compare/main...feature-branch?quick_pull=1&labels=grafana",
	}

	recorder.SetRefURLs(ctx, expectedRefURLs)

	// Verify RefURLs are stored
	recorder.mu.RLock()
	assert.Equal(t, expectedRefURLs, recorder.refURLs)
	recorder.mu.RUnlock()

	// Test that RefURLs are included in the final status
	finalStatus := recorder.Complete(ctx, nil)
	assert.Equal(t, expectedRefURLs, finalStatus.URLs)
}

func TestJobProgressRecorderSetRefURLsNil(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Test setting nil RefURLs
	recorder.SetRefURLs(ctx, nil)

	// Verify nil RefURLs are stored
	recorder.mu.RLock()
	assert.Nil(t, recorder.refURLs)
	recorder.mu.RUnlock()

	// Test that nil RefURLs are included in the final status
	finalStatus := recorder.Complete(ctx, nil)
	assert.Nil(t, finalStatus.URLs)
}

func TestJobProgressRecorderCompleteIncludesRefURLs(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Set some RefURLs
	refURLs := &provisioning.RepositoryURLs{
		SourceURL: "https://github.com/grafana/grafana/tree/test-branch",
	}
	recorder.SetRefURLs(ctx, refURLs)

	// Complete the job
	finalStatus := recorder.Complete(ctx, nil)

	// Verify the final status includes RefURLs
	require.NotNil(t, finalStatus.URLs)
	assert.Equal(t, refURLs.SourceURL, finalStatus.URLs.SourceURL)
	assert.Equal(t, provisioning.JobStateSuccess, finalStatus.State)
	assert.Equal(t, "completed successfully", finalStatus.Message)
}
