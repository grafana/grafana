package jobs

import (
	"context"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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
		name:    "test-resource",
		group:   "test.grafana.app",
		kind:    "Dashboard",
		path:    "dashboards/test.json",
		action:  repository.FileActionUpdated,
		warning: warningErr,
	}
	recorder.Record(ctx, result)

	// Record another result with a different warning
	warningErr2 := errors.New("missing optional field")
	result2 := JobResourceResult{
		name:    "test-resource-2",
		group:   "test.grafana.app",
		kind:    "Dashboard",
		path:    "dashboards/test2.json",
		action:  repository.FileActionCreated,
		warning: warningErr2,
	}
	recorder.Record(ctx, result2)

	// Record a result with a warning from a different resource type
	warningErr3 := errors.New("validation warning")
	result3 := JobResourceResult{
		name:    "test-resource-3",
		group:   "test.grafana.app",
		kind:    "DataSource",
		path:    "datasources/test.yaml",
		action:  repository.FileActionCreated,
		warning: warningErr3,
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
	expectedWarnings := []string{
		"deprecated API used (file: dashboards/test.json, name: test-resource, action: updated)",
		"missing optional field (file: dashboards/test2.json, name: test-resource-2, action: created)",
		"validation warning (file: datasources/test.yaml, name: test-resource-3, action: created)",
	}
	assert.ElementsMatch(t, finalStatus.Warnings, expectedWarnings)

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
		name:   "test-resource",
		group:  "test.grafana.app",
		kind:   "Dashboard",
		path:   "dashboards/test.json",
		action: repository.FileActionUpdated,
		err:    errorErr,
	}
	recorder.Record(ctx, result)

	// Record a result with only a warning
	warningErr := errors.New("deprecated API used")
	result2 := JobResourceResult{
		name:    "test-resource-2",
		group:   "test.grafana.app",
		kind:    "Dashboard",
		path:    "dashboards/test2.json",
		action:  repository.FileActionCreated,
		warning: warningErr,
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
		name:    "test-resource",
		group:   "test.grafana.app",
		kind:    "Dashboard",
		path:    "dashboards/test.json",
		action:  repository.FileActionUpdated,
		warning: warningErr,
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

func TestJobProgressRecorderWarningClassification(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Test that ParseError (which implements WarningError) is automatically classified as a warning
	parseErr := resources.NewParseError("unable to read file as a resource")
	result := NewJobResourceResult(
		"test-resource",
		"test.grafana.app",
		"Dashboard",
		"dashboards/test.json",
		repository.FileActionCreated,
		parseErr,
	)

	// Verify that ParseError was classified as a warning, not an error
	assert.Nil(t, result.Error(), "ParseError should be classified as warning, not error")
	assert.NotNil(t, result.Warning(), "ParseError should be classified as warning")
	assert.Equal(t, parseErr, result.Warning())

	// Record the result
	recorder.Record(ctx, result)

	// Verify it's stored as a warning in summaries
	recorder.mu.RLock()
	require.Len(t, recorder.summaries, 1)
	dashboardSummary := recorder.summaries["test.grafana.app:Dashboard"]
	require.NotNil(t, dashboardSummary)
	assert.Equal(t, int64(1), dashboardSummary.Warning)
	assert.Len(t, dashboardSummary.Warnings, 1)
	assert.Contains(t, dashboardSummary.Warnings[0], "unable to read file as a resource")
	assert.Equal(t, int64(0), dashboardSummary.Error)
	assert.Len(t, dashboardSummary.Errors, 0)
	recorder.mu.RUnlock()

	// Complete the job and verify final status
	finalStatus := recorder.Complete(ctx, nil)
	assert.Equal(t, provisioning.JobStateWarning, finalStatus.State)
	assert.Equal(t, "completed with warnings", finalStatus.Message)
	assert.Empty(t, finalStatus.Errors)
	require.NotNil(t, finalStatus.Warnings)
	assert.Len(t, finalStatus.Warnings, 1)
	assert.Contains(t, finalStatus.Warnings[0], "unable to read file as a resource")

	// Test that regular errors are still classified as errors
	regularErr := errors.New("regular error")
	result2 := NewJobResourceResult(
		"test-resource-2",
		"test.grafana.app",
		"Dashboard",
		"dashboards/test2.json",
		repository.FileActionUpdated,
		regularErr,
	)

	// Verify that regular error was classified as an error, not a warning
	assert.NotNil(t, result2.Error(), "Regular error should be classified as error")
	assert.Nil(t, result2.Warning(), "Regular error should not be classified as warning")
	assert.Equal(t, regularErr, result2.Error())
}
