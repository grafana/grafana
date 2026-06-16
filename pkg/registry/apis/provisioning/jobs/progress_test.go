package jobs

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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

	// No typed warning reasons (these are generic string warnings, not job-level)
	assert.Empty(t, recorder.ResultReasons())
}

func TestJobProgressRecorderWarningWithErrors(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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

func TestJobProgressRecorderFolderFailureTrackingFromWarning(t *testing.T) {
	ctx := context.Background()

	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

	// Folder depth violations are surfaced as warnings instead of errors so
	// the job is not retried in a loop. They must still populate
	// failedCreations so that descendant resources are short-circuited
	// instead of generating duplicate bad requests for the same offending
	// path.
	depthErr := resources.NewFolderDepthExceededError(
		"too/deep/folder/",
		errors.New("folder max depth exceeded, max depth is 4"),
	)
	pathErr := &resources.PathCreationError{
		Path: "too/deep/folder/",
		Err:  depthErr,
	}
	recorder.Record(ctx, NewFolderResult("too/deep/folder/").
		WithAction(repository.FileActionCreated).
		WithError(pathErr).
		Build())

	recorder.mu.RLock()
	defer recorder.mu.RUnlock()
	assert.Contains(t, recorder.failedCreations, "too/deep/folder/", "depth-exceeded warning should still mark the path as a failed creation")
	assert.Empty(t, recorder.errors, "depth-exceeded warning should not contribute to the error list")
	assert.Equal(t, 0, recorder.errorCount, "depth-exceeded warning should not increment error count")
}

func TestJobProgressRecorderFolderUIDTooLongFailureTrackingFromWarning(t *testing.T) {
	ctx := context.Background()

	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

	// Folder UID-length violations are surfaced as warnings instead of
	// errors so the job is not retried in a loop. They must still populate
	// failedCreations so that descendant resources are short-circuited
	// instead of generating duplicate bad requests for the same offending
	// path.
	uidErr := resources.NewFolderUIDTooLongError(
		"GMPO/bare-metal-services-engineering/",
		"a0123456789012345678901234567890123456789",
		errors.New("uid too long, max 40 characters"),
	)
	pathErr := &resources.PathCreationError{
		Path: "GMPO/bare-metal-services-engineering/",
		Err:  uidErr,
	}
	recorder.Record(ctx, NewFolderResult("GMPO/bare-metal-services-engineering/").
		WithAction(repository.FileActionCreated).
		WithError(pathErr).
		Build())

	recorder.mu.RLock()
	defer recorder.mu.RUnlock()
	assert.Contains(t, recorder.failedCreations, "GMPO/bare-metal-services-engineering/", "uid-too-long warning should still mark the path as a failed creation")
	assert.Empty(t, recorder.errors, "uid-too-long warning should not contribute to the error list")
	assert.Equal(t, 0, recorder.errorCount, "uid-too-long warning should not increment error count")
}

func TestJobProgressRecorderFolderValidationFailureTrackingFromWarning(t *testing.T) {
	ctx := context.Background()

	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

	// Generic folder-API validation rejections (illegal-uid-chars,
	// reserved-uid, future folder validations) must follow the same
	// failed-creations short-circuit as the more specific depth/UID
	// cases so descendant resources don't burst-write identical bad
	// requests against the folder API.
	validationErr := resources.NewFolderValidationError(
		"bad-folder/",
		errors.New("uid contains illegal characters"),
	)
	pathErr := &resources.PathCreationError{
		Path: "bad-folder/",
		Err:  validationErr,
	}
	recorder.Record(ctx, NewFolderResult("bad-folder/").
		WithAction(repository.FileActionCreated).
		WithError(pathErr).
		Build())

	recorder.mu.RLock()
	defer recorder.mu.RUnlock()
	assert.Contains(t, recorder.failedCreations, "bad-folder/", "folder validation warning should still mark the path as a failed creation")
	assert.Empty(t, recorder.errors, "folder validation warning should not contribute to the error list")
	assert.Equal(t, 0, recorder.errorCount, "folder validation warning should not increment error count")
}

func TestJobProgressRecorderHasDirPathFailedCreation(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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

func TestJobProgressRecorderHasChildPathFailedCreation(t *testing.T) {
	ctx := context.Background()

	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

	pathErr1 := &resources.PathCreationError{
		Path: "alpha/beta/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, NewPathOnlyResult("alpha/beta/file.json").
		WithError(pathErr1).
		WithAction(repository.FileActionCreated).
		Build())

	pathErr2 := &resources.PathCreationError{
		Path: "x/y/z/",
		Err:  assert.AnError,
	}
	recorder.Record(ctx, NewPathOnlyResult("x/y/z/file.json").
		WithError(pathErr2).
		WithAction(repository.FileActionCreated).
		Build())

	// Ancestor folders of a failed child should return true
	assert.True(t, recorder.HasChildPathFailedCreation("alpha/"), "alpha/ contains failing child alpha/beta/")
	assert.True(t, recorder.HasChildPathFailedCreation("x/"), "x/ contains failing child x/y/z/")
	assert.True(t, recorder.HasChildPathFailedCreation("x/y/"), "x/y/ contains failing child x/y/z/")

	// The exact failing path itself should also match
	assert.True(t, recorder.HasChildPathFailedCreation("alpha/beta/"), "exact path should match itself")
	assert.True(t, recorder.HasChildPathFailedCreation("x/y/z/"), "exact path should match itself")

	// Sibling or unrelated paths should return false
	assert.False(t, recorder.HasChildPathFailedCreation("alpha/gamma/"), "no failures under alpha/gamma/")
	assert.False(t, recorder.HasChildPathFailedCreation("other/"), "no failures under other/")
	assert.False(t, recorder.HasChildPathFailedCreation("x/y/z/deeper/"), "nothing nested deeper than x/y/z/")

	// Empty recorder should always return false
	emptyRecorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)
	assert.False(t, emptyRecorder.HasChildPathFailedCreation("alpha/"))
}

func TestJobProgressRecorderHasChildPathFailedUpdate(t *testing.T) {
	ctx := context.Background()

	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

	recorder.Record(ctx, NewResourceResult().
		WithPath("alpha/beta/dash.json").
		WithAction(repository.FileActionUpdated).
		WithError(assert.AnError).
		Build())

	recorder.Record(ctx, NewResourceResult().
		WithPath("x/y/z/panel.json").
		WithAction(repository.FileActionUpdated).
		WithError(assert.AnError).
		Build())

	// Ancestor folders of a failed child should return true
	assert.True(t, recorder.HasChildPathFailedUpdate("alpha/"), "alpha/ contains failing child alpha/beta/dash.json")
	assert.True(t, recorder.HasChildPathFailedUpdate("alpha/beta/"), "alpha/beta/ contains failing child")
	assert.True(t, recorder.HasChildPathFailedUpdate("x/"), "x/ contains failing child x/y/z/panel.json")
	assert.True(t, recorder.HasChildPathFailedUpdate("x/y/"), "x/y/ contains failing child")
	assert.True(t, recorder.HasChildPathFailedUpdate("x/y/z/"), "x/y/z/ contains failing child")

	// Sibling or unrelated paths should return false
	assert.False(t, recorder.HasChildPathFailedUpdate("alpha/gamma/"), "no failures under alpha/gamma/")
	assert.False(t, recorder.HasChildPathFailedUpdate("other/"), "no failures under other/")

	// Successful updates are NOT tracked
	recorder.Record(ctx, NewResourceResult().
		WithPath("success/dash.json").
		WithAction(repository.FileActionUpdated).
		Build())
	assert.False(t, recorder.HasChildPathFailedUpdate("success/"), "successful updates are not tracked")

	// Non-update failures are NOT tracked as update failures
	recorder.Record(ctx, NewResourceResult().
		WithPath("created/dash.json").
		WithAction(repository.FileActionCreated).
		WithError(assert.AnError).
		Build())
	assert.False(t, recorder.HasChildPathFailedUpdate("created/"), "creation failures are not tracked as update failures")

	// Warning-level update failures ARE tracked (e.g. validation errors routed
	// to warning via isWarningError).
	validationErr := resources.NewResourceValidationError(errors.New("invalid content"))
	recorder.Record(ctx, NewResourceResult().
		WithPath("warned/dash.json").
		WithAction(repository.FileActionUpdated).
		WithError(validationErr).
		Build())
	assert.True(t, recorder.HasChildPathFailedUpdate("warned/"), "warning-level update failures must be tracked")

	recorder.Record(ctx, NewResourceResult().
		WithPath("explicit-warn/panel.json").
		WithAction(repository.FileActionUpdated).
		WithWarning(errors.New("ownership conflict")).
		Build())
	assert.True(t, recorder.HasChildPathFailedUpdate("explicit-warn/"), "explicit WithWarning updates must be tracked")

	// Non-failing warnings (missing/invalid folder metadata) are NOT tracked
	// because the underlying folder operation succeeded.
	recorder.Record(ctx, NewResourceResult().
		WithPath("missing-meta/").
		WithAction(repository.FileActionUpdated).
		WithWarning(resources.NewMissingFolderMetadata("missing-meta/")).
		Build())
	assert.False(t, recorder.HasChildPathFailedUpdate("missing-meta/"), "missing folder metadata warnings must not be tracked as failed updates")

	recorder.Record(ctx, NewResourceResult().
		WithPath("invalid-meta/").
		WithAction(repository.FileActionUpdated).
		WithWarning(resources.NewInvalidFolderMetadata("invalid-meta/", errors.New("bad json"))).
		Build())
	assert.False(t, recorder.HasChildPathFailedUpdate("invalid-meta/"), "invalid folder metadata warnings must not be tracked as failed updates")

	// Failed renames are tracked as update failures — a rename moves a child,
	// so if it fails the child stays under the old folder.
	// Cross-folder rename: source is oldfolder/, destination is newfolder/.
	// Both paths must be tracked so the old folder is not deleted prematurely.
	recorder.Record(ctx, NewResourceResult().
		WithPath("newfolder/old-dash.json").
		WithPreviousPath("oldfolder/old-dash.json").
		WithAction(repository.FileActionRenamed).
		WithError(assert.AnError).
		Build())
	assert.True(t, recorder.HasChildPathFailedUpdate("oldfolder/"), "failed renames must protect the source folder")
	assert.True(t, recorder.HasChildPathFailedUpdate("newfolder/"), "failed renames must also protect the destination folder")

	recorder.Record(ctx, NewResourceResult().
		WithPath("new-warn/panel.json").
		WithPreviousPath("old-warn/panel.json").
		WithAction(repository.FileActionRenamed).
		WithWarning(errors.New("rename conflict")).
		Build())
	assert.True(t, recorder.HasChildPathFailedUpdate("old-warn/"), "warning-level rename failures must protect the source folder")
	assert.True(t, recorder.HasChildPathFailedUpdate("new-warn/"), "warning-level rename failures must protect the destination folder")

	// Empty recorder should always return false
	emptyRecorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)
	assert.False(t, emptyRecorder.HasChildPathFailedUpdate("alpha/"))
}

func TestJobProgressRecorderFailedUpdatesTracking(t *testing.T) {
	ctx := context.Background()

	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

	// Record update failures
	recorder.Record(ctx, NewResourceResult().
		WithPath("folder1/dash.json").
		WithAction(repository.FileActionUpdated).
		WithError(assert.AnError).
		Build())

	recorder.Record(ctx, NewResourceResult().
		WithPath("folder2/panel.json").
		WithAction(repository.FileActionUpdated).
		WithError(assert.AnError).
		Build())

	// Verify failedUpdates are tracked
	recorder.mu.RLock()
	assert.Len(t, recorder.failedUpdates, 2)
	assert.Contains(t, recorder.failedUpdates, "folder1/dash.json")
	assert.Contains(t, recorder.failedUpdates, "folder2/panel.json")
	recorder.mu.RUnlock()

	// Verify ResetResults clears failedUpdates
	recorder.ResetResults(false)
	recorder.mu.RLock()
	assert.Nil(t, recorder.failedUpdates)
	recorder.mu.RUnlock()
}

func TestJobProgressRecorderResetResults(t *testing.T) {
	ctx := context.Background()

	// Create a progress recorder
	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

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

func TestJobProgressRecorderResultReasons(t *testing.T) {
	ctx := context.Background()

	t.Run("Record accumulates warning reasons from results", func(t *testing.T) {
		mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error { return nil }
		recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

		quotaErr := quotas.NewQuotaExceededError(errors.New("over quota"))
		recorder.Record(ctx, NewResourceResult().WithError(quotaErr).Build())

		assert.Contains(t, recorder.ResultReasons(), provisioning.ReasonQuotaExceeded)
	})

	t.Run("duplicate warning reasons are deduplicated", func(t *testing.T) {
		mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error { return nil }
		recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

		quotaErr1 := quotas.NewQuotaExceededError(errors.New("over quota 1"))
		quotaErr2 := quotas.NewQuotaExceededError(errors.New("over quota 2"))
		recorder.Record(ctx, NewResourceResult().WithError(quotaErr1).Build())
		recorder.Record(ctx, NewResourceResult().WithError(quotaErr2).Build())

		reasons := recorder.ResultReasons()
		assert.Len(t, reasons, 1)
		assert.Contains(t, reasons, provisioning.ReasonQuotaExceeded)
	})

	t.Run("Complete with warning error does not set Error state", func(t *testing.T) {
		mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error { return nil }
		recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

		quotaErr := quotas.NewQuotaExceededError(errors.New("over quota"))
		recorder.Record(ctx, NewResourceResult().WithError(quotaErr).Build())

		finalStatus := recorder.Complete(ctx, quotaErr)
		assert.Equal(t, provisioning.JobStateWarning, finalStatus.State)
		assert.Contains(t, recorder.ResultReasons(), provisioning.ReasonQuotaExceeded)
	})

	t.Run("Complete with real error still sets Error state", func(t *testing.T) {
		mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error { return nil }
		recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

		finalStatus := recorder.Complete(ctx, errors.New("network failure"))
		assert.Equal(t, provisioning.JobStateError, finalStatus.State)
		assert.Empty(t, recorder.ResultReasons())
	})

	t.Run("ResetResults with keepWarnings=true preserves warning reasons", func(t *testing.T) {
		mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error { return nil }
		recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

		quotaErr := quotas.NewQuotaExceededError(errors.New("over quota"))
		recorder.Record(ctx, NewResourceResult().WithError(quotaErr).Build())

		recorder.ResetResults(true)

		recorder.mu.RLock()
		assert.Len(t, recorder.resultReasons, 1)
		recorder.mu.RUnlock()
	})

	t.Run("ResetResults with keepWarnings=false clears warning reasons", func(t *testing.T) {
		mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error { return nil }
		recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

		quotaErr := quotas.NewQuotaExceededError(errors.New("over quota"))
		recorder.Record(ctx, NewResourceResult().WithError(quotaErr).Build())

		recorder.ResetResults(false)

		recorder.mu.RLock()
		assert.Empty(t, recorder.resultReasons)
		recorder.mu.RUnlock()
	})
}

func TestJobProgressRecorderTooManyErrorsConcurrency(t *testing.T) {
	ctx := context.Background()

	mockProgressFn := func(ctx context.Context, status provisioning.JobStatus) error { return nil }
	recorder := newJobProgressRecorder(mockProgressFn, nil, "").(*jobProgressRecorder)

	const maxErrors = 5
	const goroutines = 20
	recorder.StrictMaxErrors(maxErrors)

	var wg sync.WaitGroup
	wg.Add(goroutines)
	for range goroutines {
		go func() {
			defer wg.Done()
			recorder.Record(ctx, NewPathOnlyResult("file.json").
				WithError(assert.AnError).
				WithAction(repository.FileActionCreated).
				Build())
			_ = recorder.TooManyErrors()
		}()
	}
	wg.Wait()

	err := recorder.TooManyErrors()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "too many errors")
}
