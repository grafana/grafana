package jobs

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testLogger implements logging.Logger and captures log calls for testing
type testLogger struct {
	mu        *sync.Mutex
	debugLogs *[]logEntry
	infoLogs  *[]logEntry
	warnLogs  *[]logEntry
	errorLogs *[]logEntry
	fields    []any
}

type logEntry struct {
	msg    string
	fields []any
}

func newTestLogger() *testLogger {
	return &testLogger{
		mu:        &sync.Mutex{},
		debugLogs: &[]logEntry{},
		infoLogs:  &[]logEntry{},
		warnLogs:  &[]logEntry{},
		errorLogs: &[]logEntry{},
		fields:    make([]any, 0),
	}
}

func (l *testLogger) Debug(msg string, fields ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	allFields := append([]any{}, l.fields...)
	allFields = append(allFields, fields...)
	*l.debugLogs = append(*l.debugLogs, logEntry{msg: msg, fields: allFields})
}

func (l *testLogger) Info(msg string, fields ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	allFields := append([]any{}, l.fields...)
	allFields = append(allFields, fields...)
	*l.infoLogs = append(*l.infoLogs, logEntry{msg: msg, fields: allFields})
}

func (l *testLogger) Warn(msg string, fields ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	allFields := append([]any{}, l.fields...)
	allFields = append(allFields, fields...)
	*l.warnLogs = append(*l.warnLogs, logEntry{msg: msg, fields: allFields})
}

func (l *testLogger) Error(msg string, fields ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	allFields := append([]any{}, l.fields...)
	allFields = append(allFields, fields...)
	*l.errorLogs = append(*l.errorLogs, logEntry{msg: msg, fields: allFields})
}

func (l *testLogger) With(fields ...any) logging.Logger {
	newFields := append([]any{}, l.fields...)
	newFields = append(newFields, fields...)
	return &testLogger{
		mu:        l.mu,
		debugLogs: l.debugLogs,
		infoLogs:  l.infoLogs,
		warnLogs:  l.warnLogs,
		errorLogs: l.errorLogs,
		fields:    newFields,
	}
}

func (l *testLogger) WithContext(ctx context.Context) logging.Logger {
	// For testing, we just return the same logger
	return l
}

func (l *testLogger) GetDebugLogs() []logEntry {
	l.mu.Lock()
	defer l.mu.Unlock()
	return append([]logEntry{}, *l.debugLogs...)
}

func (l *testLogger) GetInfoLogs() []logEntry {
	l.mu.Lock()
	defer l.mu.Unlock()
	return append([]logEntry{}, *l.infoLogs...)
}

func (l *testLogger) GetWarnLogs() []logEntry {
	l.mu.Lock()
	defer l.mu.Unlock()
	return append([]logEntry{}, *l.warnLogs...)
}

func (l *testLogger) GetErrorLogs() []logEntry {
	l.mu.Lock()
	defer l.mu.Unlock()
	return append([]logEntry{}, *l.errorLogs...)
}

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

	// When there are errors, the state should be Error (any errors = error state)
	// Warnings should still be included in the response
	assert.Equal(t, provisioning.JobStateError, finalStatus.State)
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

func TestJobProgressRecorderFolderFailureTracking(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Record a folder creation failure with PathCreationError
	pathErr := &resources.PathCreationError{
		Path: "folder1/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, NewPathOnlyResult("folder1/file.json").
		WithError(pathErr).
		WithAction(repository.FileActionCreated).
		Build())

	// Record another PathCreationError for a different folder
	pathErr2 := &resources.PathCreationError{
		Path: "folder2/subfolder/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, NewPathOnlyResult("folder2/subfolder/file.json").
		WithError(pathErr2).
		WithAction(repository.FileActionCreated).
		Build())

	// Record a deletion failure
	recorder.Record(ctx,
		NewPathOnlyResult("folder3/file1.json").
			WithError(assert.AnError).
			WithAction(repository.FileActionDeleted).
			Build())

	// Record another deletion failure
	recorder.Record(ctx,
		NewPathOnlyResult("folder4/subfolder/file2.json").
			WithError(assert.AnError).
			WithAction(repository.FileActionDeleted).
			Build())

	// Verify failed creations are tracked
	recorder.mu.RLock()
	assert.Len(t, recorder.failedCreations, 2)
	assert.Contains(t, recorder.failedCreations, "folder1/")
	assert.Contains(t, recorder.failedCreations, "folder2/subfolder/")

	// Verify failed deletions are tracked
	assert.Len(t, recorder.failedDeletions, 2)
	assert.Contains(t, recorder.failedDeletions, "folder3/file1.json")
	assert.Contains(t, recorder.failedDeletions, "folder4/subfolder/file2.json")
	recorder.mu.RUnlock()
}

func TestJobProgressRecorderHasDirPathFailedCreation(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Add failed creations via Record
	pathErr1 := &resources.PathCreationError{
		Path: "folder1/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, NewPathOnlyResult("folder1/file.json").
		WithError(pathErr1).
		WithAction(repository.FileActionCreated).
		Build())

	pathErr2 := &resources.PathCreationError{
		Path: "folder2/subfolder/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, NewPathOnlyResult("folder2/subfolder/file.json").
		WithError(pathErr2).
		WithAction(repository.FileActionCreated).
		Build())

	// Test nested paths
	assert.True(t, recorder.HasDirPathFailedCreation("folder1/file.json"))
	assert.True(t, recorder.HasDirPathFailedCreation("folder1/nested/file.json"))
	assert.True(t, recorder.HasDirPathFailedCreation("folder2/subfolder/file.json"))

	// Test non-nested paths
	assert.False(t, recorder.HasDirPathFailedCreation("folder2/file2.json"))
	assert.False(t, recorder.HasDirPathFailedCreation("folder2/othersubfolder/inside.json"))
	assert.False(t, recorder.HasDirPathFailedCreation("other/file.json"))
	assert.False(t, recorder.HasDirPathFailedCreation("folder3/file.json"))
	assert.False(t, recorder.HasDirPathFailedCreation("file.json"))
}

func TestJobProgressRecorderHasDirPathFailedDeletion(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Add failed deletions via Record
	recorder.Record(ctx, NewPathOnlyResult("folder1/file1.json").
		WithError(assert.AnError).
		WithAction(repository.FileActionDeleted).
		Build())

	recorder.Record(ctx, NewPathOnlyResult("folder2/subfolder/file2.json").
		WithError(assert.AnError).
		WithAction(repository.FileActionDeleted).
		Build())

	recorder.Record(ctx, NewPathOnlyResult("folder3/nested/deep/file3.json").
		WithError(assert.AnError).
		WithAction(repository.FileActionDeleted).
		Build())

	// Test folder paths with failed deletions
	assert.True(t, recorder.HasDirPathFailedDeletion("folder1/"))
	assert.True(t, recorder.HasDirPathFailedDeletion("folder2/"))
	assert.True(t, recorder.HasDirPathFailedDeletion("folder2/subfolder/"))
	assert.True(t, recorder.HasDirPathFailedDeletion("folder3/"))
	assert.True(t, recorder.HasDirPathFailedDeletion("folder3/nested/"))
	assert.True(t, recorder.HasDirPathFailedDeletion("folder3/nested/deep/"))

	// Test folder paths without failed deletions
	assert.False(t, recorder.HasDirPathFailedDeletion("other/"))
	assert.False(t, recorder.HasDirPathFailedDeletion("different/"))
	assert.False(t, recorder.HasDirPathFailedDeletion("folder2/othersubfolder/"))
	assert.False(t, recorder.HasDirPathFailedDeletion("folder2/subfolder/othersubfolder/"))
	assert.False(t, recorder.HasDirPathFailedDeletion("folder3/nested/anotherdeep/"))
	assert.False(t, recorder.HasDirPathFailedDeletion("folder3/nested/deep/insidedeep/"))
}

func TestJobProgressRecorderResetResults(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Add some data via Record
	pathErr := &resources.PathCreationError{
		Path: "folder1/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, NewPathOnlyResult("folder1/file.json").
		WithError(pathErr).
		WithAction(repository.FileActionCreated).
		Build())

	recorder.Record(ctx, NewPathOnlyResult("folder2/file.json").
		WithError(assert.AnError).
		WithAction(repository.FileActionDeleted).
		Build())

	// Verify data is stored
	recorder.mu.RLock()
	assert.Len(t, recorder.failedCreations, 1)
	assert.Len(t, recorder.failedDeletions, 1)
	recorder.mu.RUnlock()

	// Reset results
	recorder.ResetResults(false)

	// Verify data is cleared
	recorder.mu.RLock()
	assert.Nil(t, recorder.failedCreations)
	assert.Nil(t, recorder.failedDeletions)
	recorder.mu.RUnlock()
}

func TestJobProgressRecorderLogsWarningsAtWarnLevel(t *testing.T) {
	logger := newTestLogger()
	ctx := logging.Context(context.Background(), logger)

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Record a result with a warning (validation error)
	validationErr := resources.NewResourceValidationError(errors.New("missing name in resource"))
	result := NewResourceResult().
		WithName("test-resource").
		WithGroup("test.grafana.app").
		WithKind("Dashboard").
		WithPath("dashboards/test.json").
		WithAction(repository.FileActionCreated).
		WithError(validationErr).
		Build()

	recorder.Record(ctx, result)

	// Verify that the warning was logged at WARN level, not ERROR level
	warnLogs := logger.GetWarnLogs()
	errorLogs := logger.GetErrorLogs()
	infoLogs := logger.GetInfoLogs()

	assert.Len(t, warnLogs, 1, "should have exactly 1 warning log")
	assert.Empty(t, errorLogs, "should NOT have any error logs for validation errors")
	assert.Empty(t, infoLogs, "should NOT have info logs for warnings")

	// Verify the warning message
	assert.Equal(t, "job resource operation completed with warning", warnLogs[0].msg)
}

func TestJobProgressRecorderLogsErrorsAtErrorLevel(t *testing.T) {
	logger := newTestLogger()
	ctx := logging.Context(context.Background(), logger)

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Record a result with an actual error (not a validation error)
	actualError := errors.New("network failure")
	result := NewResourceResult().
		WithName("test-resource").
		WithGroup("test.grafana.app").
		WithKind("Dashboard").
		WithPath("dashboards/test.json").
		WithAction(repository.FileActionCreated).
		WithError(actualError).
		Build()

	recorder.Record(ctx, result)

	// Verify that the error was logged at ERROR level
	warnLogs := logger.GetWarnLogs()
	errorLogs := logger.GetErrorLogs()
	infoLogs := logger.GetInfoLogs()

	assert.Len(t, errorLogs, 1, "should have exactly 1 error log")
	assert.Empty(t, warnLogs, "should NOT have warning logs for actual errors")
	assert.Empty(t, infoLogs, "should NOT have info logs for errors")

	// Verify the error message
	assert.Equal(t, "job resource operation failed", errorLogs[0].msg)
}

func TestJobProgressRecorderLogsSuccessAtInfoLevel(t *testing.T) {
	logger := newTestLogger()
	ctx := logging.Context(context.Background(), logger)

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Record a successful result
	result := NewResourceResult().
		WithName("test-resource").
		WithGroup("test.grafana.app").
		WithKind("Dashboard").
		WithPath("dashboards/test.json").
		WithAction(repository.FileActionCreated).
		Build()

	recorder.Record(ctx, result)

	// Verify that success was logged at INFO level
	warnLogs := logger.GetWarnLogs()
	errorLogs := logger.GetErrorLogs()
	infoLogs := logger.GetInfoLogs()

	assert.Len(t, infoLogs, 1, "should have exactly 1 info log")
	assert.Empty(t, warnLogs, "should NOT have warning logs for success")
	assert.Empty(t, errorLogs, "should NOT have error logs for success")

	// Verify the info message
	assert.Equal(t, "job resource operation succeeded", infoLogs[0].msg)
}

func TestJobProgressRecorderIgnoredActionsDontCountAsErrors(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn).(*jobProgressRecorder)

	// Record an ignored action with error
	recorder.Record(ctx, NewPathOnlyResult("folder1/file1.json").
		WithError(assert.AnError).
		WithAction(repository.FileActionIgnored).
		Build())

	// Record a real error for comparison
	recorder.Record(ctx, NewPathOnlyResult("folder2/file2.json").
		WithError(assert.AnError).
		WithAction(repository.FileActionCreated).
		Build())

	// Verify error count doesn't include ignored actions
	recorder.mu.RLock()
	assert.Equal(t, 1, recorder.errorCount, "ignored actions should not be counted as errors")
	assert.Len(t, recorder.errors, 1, "ignored action errors should not be in error list")
	recorder.mu.RUnlock()
}
