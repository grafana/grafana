package jobs

import (
	"context"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
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

func TestJobProgressRecorderWarningStatus(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Record a result with a warning
	warningErr := errors.New("deprecated API used")
	result := JobResourceResult{
		Name:    "test-resource",
		Group:   "test.grafana.app",
		Kind:    "Dashboard",
		Path:    "dashboards/test.json",
		Action:  repository.FileActionUpdated,
		Warning: warningErr,
	}
	recorder.Record(ctx, result)

	// Record another result with a different warning
	warningErr2 := errors.New("missing optional field")
	result2 := JobResourceResult{
		Name:    "test-resource-2",
		Group:   "test.grafana.app",
		Kind:    "Dashboard",
		Path:    "dashboards/test2.json",
		Action:  repository.FileActionCreated,
		Warning: warningErr2,
	}
	recorder.Record(ctx, result2)

	// Record a result with a warning from a different resource type
	warningErr3 := errors.New("validation warning")
	result3 := JobResourceResult{
		Name:    "test-resource-3",
		Group:   "test.grafana.app",
		Kind:    "DataSource",
		Path:    "datasources/test.yaml",
		Action:  repository.FileActionCreated,
		Warning: warningErr3,
	}
	recorder.Record(ctx, result3)

	// Verify warnings are stored in summaries
	recorder.mu.RLock()
	require.Len(t, recorder.summaries, 2) // Dashboard and DataSource
	dashboardSummary := recorder.summaries["test.grafana.app:Dashboard"]
	require.NotNil(t, dashboardSummary)
	assert.Equal(t, int64(2), dashboardSummary.Warning)
	assert.Len(t, dashboardSummary.Warnings, 2)
	assert.Contains(t, dashboardSummary.Warnings[0], "deprecated API used")
	assert.Contains(t, dashboardSummary.Warnings[1], "missing optional field")

	datasourceSummary := recorder.summaries["test.grafana.app:DataSource"]
	require.NotNil(t, datasourceSummary)
	assert.Equal(t, int64(1), datasourceSummary.Warning)
	assert.Len(t, datasourceSummary.Warnings, 1)
	assert.Contains(t, datasourceSummary.Warnings[0], "validation warning")
	recorder.mu.RUnlock()

	// Complete the job
	finalStatus := recorder.Complete(ctx, nil)

	// Verify the final status includes warnings
	require.NotNil(t, finalStatus.Warnings)
	assert.Len(t, finalStatus.Warnings, 3)
	assert.Contains(t, finalStatus.Warnings[0], "deprecated API used")
	assert.Contains(t, finalStatus.Warnings[1], "missing optional field")
	assert.Contains(t, finalStatus.Warnings[2], "validation warning")

	// Verify the state is set to Warning
	assert.Equal(t, provisioning.JobStateWarning, finalStatus.State)
	assert.Equal(t, "completed with warnings", finalStatus.Message)

	// Verify summaries are included
	require.Len(t, finalStatus.Summary, 2)

	// Verify no errors were recorded
	assert.Empty(t, finalStatus.Errors)
}

func TestJobProgressRecorderWarningWithErrors(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Record a result with an error (errors take precedence)
	errorErr := errors.New("failed to process")
	result := JobResourceResult{
		Name:   "test-resource",
		Group:  "test.grafana.app",
		Kind:   "Dashboard",
		Path:   "dashboards/test.json",
		Action: repository.FileActionUpdated,
		Error:  errorErr,
	}
	recorder.Record(ctx, result)

	// Record a result with only a warning
	warningErr := errors.New("deprecated API used")
	result2 := JobResourceResult{
		Name:    "test-resource-2",
		Group:   "test.grafana.app",
		Kind:    "Dashboard",
		Path:    "dashboards/test2.json",
		Action:  repository.FileActionCreated,
		Warning: warningErr,
	}
	recorder.Record(ctx, result2)

	// Complete the job
	finalStatus := recorder.Complete(ctx, nil)

	// When there are errors, the state should be Warning (not Error unless too many)
	// and warnings should still be included
	assert.Equal(t, provisioning.JobStateWarning, finalStatus.State)
	assert.Equal(t, "completed with errors", finalStatus.Message)
	assert.Len(t, finalStatus.Errors, 1)
	assert.Contains(t, finalStatus.Errors[0], "failed to process")

	// Warnings should still be extracted from summaries
	require.NotNil(t, finalStatus.Warnings)
	assert.Len(t, finalStatus.Warnings, 1)
	assert.Contains(t, finalStatus.Warnings[0], "deprecated API used")
}

func TestJobProgressRecorderWarningOnlyNoErrors(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Record only warnings, no errors
	warningErr := errors.New("deprecated API used")
	result := JobResourceResult{
		Name:    "test-resource",
		Group:   "test.grafana.app",
		Kind:    "Dashboard",
		Path:    "dashboards/test.json",
		Action:  repository.FileActionUpdated,
		Warning: warningErr,
	}
	recorder.Record(ctx, result)

	// Complete the job
	finalStatus := recorder.Complete(ctx, nil)

	// Verify the state is Warning (not Error) when only warnings exist
	assert.Equal(t, provisioning.JobStateWarning, finalStatus.State)
	assert.Equal(t, "completed with warnings", finalStatus.Message)
	assert.Empty(t, finalStatus.Errors)
	require.NotNil(t, finalStatus.Warnings)
	assert.Len(t, finalStatus.Warnings, 1)
}
