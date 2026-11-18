package app

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"sync"
	"testing"
	"testing/synctest"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/metrics"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestGetCheck(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetLabels(map[string]string{checks.TypeLabel: "mock"})

	check, err := getCheck(obj, &mockCheckRegistry{})
	assert.NoError(t, err)
	assert.NotNil(t, check)
}

// Checks are processed concurrently and Init keeps per-run state in the check, so every
// Check must get its own instance.
func TestGetCheck_NewInstance(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetLabels(map[string]string{checks.TypeLabel: "mock"})
	registry := &mockCheckRegistry{}

	first, err := getCheck(obj, registry)
	require.NoError(t, err)
	second, err := getCheck(obj, registry)
	require.NoError(t, err)
	assert.NotSame(t, first, second)
}

func TestGetCheck_MissingLabel(t *testing.T) {
	obj := &advisorv0alpha1.Check{}

	_, err := getCheck(obj, &mockCheckRegistry{})
	assert.Error(t, err)
	assert.Equal(t, "missing check type as label", err.Error())
}

func TestGetCheck_UnknownType(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetLabels(map[string]string{checks.TypeLabel: "unknownType"})

	_, err := getCheck(obj, &mockCheckRegistry{})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unknown check type unknownType")
	assert.Contains(t, err.Error(), "Supported types are: mock")
}

type mockCheckRegistry struct{}

func (m *mockCheckRegistry) Checks() []checks.Check {
	return []checks.Check{&mockCheck{}}
}

func (m *mockCheckRegistry) Check(id string) (checks.Check, bool) {
	if id != "mock" {
		return nil, false
	}
	return &mockCheck{}, true
}

func TestProcessCheck(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()
	check := &mockCheck{
		items: []any{"item"},
	}

	err = processCheck(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.NoError(t, err)
	assert.Equal(t, checks.StatusAnnotationProcessed, obj.GetAnnotations()[checks.StatusAnnotation])
}

func TestProcessMultipleCheckItems(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()
	items := make([]any, 100)
	for i := range items {
		if i%2 == 0 {
			items[i] = fmt.Sprintf("item-%d", i)
		} else {
			items[i] = errors.New("error")
		}
	}
	check := &mockCheck{
		items: items,
	}

	err = processCheck(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.NoError(t, err)
	assert.Equal(t, checks.StatusAnnotationProcessed, obj.GetAnnotations()[checks.StatusAnnotation])
	r := client.values[0].(advisorv0alpha1.CheckStatus)
	assert.Equal(t, r.Report.Count, int64(100))
	assert.Len(t, r.Report.Failures, 50)
}

func TestProcessCheck_RecordsReportMetrics(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	check := &mockCheck{
		items:         []any{"item-1", "item-2", "item-3", "item-4"},
		retryFailures: []advisorv0alpha1.CheckReportFailure{{StepID: "mock"}},
	}

	itemsBefore := testutil.ToFloat64(metrics.CheckItemsTotal.WithLabelValues("mock"))
	failuresBefore := testutil.ToFloat64(metrics.CheckFailuresTotal.WithLabelValues("mock", "mock"))

	err = processCheck(context.TODO(), logging.DefaultLogger, &mockClient{}, &mockTypesClient{}, obj, check)
	require.NoError(t, err)

	assert.Equal(t, float64(4), testutil.ToFloat64(metrics.CheckItemsTotal.WithLabelValues("mock"))-itemsBefore)
	assert.Equal(t, float64(4), testutil.ToFloat64(metrics.CheckFailuresTotal.WithLabelValues("mock", "mock"))-failuresBefore)
}

func TestProcessCheck_RecordsZeroFailures(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	check := &mockCheck{items: []any{"item-1"}}

	metrics.CheckFailuresTotal.Reset()
	err = processCheck(context.TODO(), logging.DefaultLogger, &mockClient{}, &mockTypesClient{}, obj, check)
	require.NoError(t, err)

	assert.Equal(t, 1, testutil.CollectAndCount(metrics.CheckFailuresTotal))
	assert.Equal(t, float64(0), testutil.ToFloat64(metrics.CheckFailuresTotal.WithLabelValues("mock", "mock")))
}

func TestProcessCheck_AlreadyProcessed(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{checks.StatusAnnotation: checks.StatusAnnotationProcessed})
	client := &mockClient{}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()
	check := &mockCheck{}

	err := processCheck(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.NoError(t, err)
}

func TestProcessCheck_RunError(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	check := &mockCheck{
		items: []any{"item"},
		err:   errors.New("run error"),
	}

	err = processCheck(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.Error(t, err)
	assert.Equal(t, checks.StatusAnnotationError, obj.GetAnnotations()[checks.StatusAnnotation])
}

func TestProcessCheck_IgnoreSteps(t *testing.T) {
	checkType := &advisorv0alpha1.CheckType{}
	checkType.SetAnnotations(map[string]string{checks.IgnoreStepsAnnotationList: "mock"})
	typesClient := &mockTypesClient{
		res: checkType,
	}
	ctx := context.TODO()
	check := &mockCheck{
		items: []any{"item"},
		err:   errors.New("run error, should not be triggered"),
	}
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{}

	err = processCheck(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.NoError(t, err)
	assert.Equal(t, checks.StatusAnnotationProcessed, obj.GetAnnotations()[checks.StatusAnnotation])
	assert.Equal(t, "mock", obj.GetAnnotations()[checks.IgnoreStepsAnnotationList])
}

func TestProcessCheck_RunRecoversFromPanic(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	check := &mockCheck{
		items:     []any{"item"},
		runPanics: true,
	}

	err = processCheck(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.NoError(t, err)
	assert.Equal(t, checks.StatusAnnotationProcessed, obj.GetAnnotations()[checks.StatusAnnotation])
}

func TestProcessCheckRetry_NoRetry(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	check := &mockCheck{}

	err = processCheckRetry(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.NoError(t, err)
}

func TestProcessCheckRetry_RetryError(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{
		checks.RetryAnnotation:  "item",
		checks.StatusAnnotation: checks.StatusAnnotationProcessed,
	})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{res: obj}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	check := &mockCheck{
		items: []any{"item"},
		err:   errors.New("retry error"),
	}

	err = processCheckRetry(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.Error(t, err)
	assert.Equal(t, checks.StatusAnnotationError, obj.GetAnnotations()[checks.StatusAnnotation])
}

func TestProcessCheckRetry_DryRun_NeverPersisted(t *testing.T) {
	// Simulates a dry-run update: the retry annotation on obj (the hypothetical new
	// state from the admission request) never actually lands in storage, since a
	// dry-run request is never persisted. grafana-app-sdk's AdmissionRequest has no
	// dryRun flag, so this is detected indirectly by the annotation never showing up
	// when polling storage. No patches should be issued in this case.
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{
		checks.RetryAnnotation:  "item",
		checks.StatusAnnotation: checks.StatusAnnotationProcessed,
	})
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetCreatedBy("user:1")

	// storedObj represents the object as it actually exists in storage: no retry
	// annotation was ever persisted for it, since the update was a dry-run.
	storedObj := &advisorv0alpha1.Check{}
	storedObj.SetAnnotations(map[string]string{
		checks.StatusAnnotation: checks.StatusAnnotationProcessed,
	})
	client := &mockClient{res: storedObj}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	check := &mockCheck{
		items: []any{"item"},
	}

	synctest.Test(t, func(t *testing.T) {
		err = processCheckRetry(ctx, logging.DefaultLogger, client, typesClient, obj, check)
		assert.Error(t, err)
		assert.Empty(t, client.values, "no patches should be issued for a retry annotation that never lands in storage")
	})
}

func TestProcessCheckRetry_SkipMissingItem(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{
		checks.RetryAnnotation:  "item",
		checks.StatusAnnotation: checks.StatusAnnotationProcessed,
	})
	obj.Status.Report.Failures = []advisorv0alpha1.CheckReportFailure{
		{
			ItemID: "item",
			StepID: "step",
		},
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{
		res: obj,
	}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	check := &mockCheck{
		items: []any{nil},
	}

	err = processCheckRetry(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.NoError(t, err)
	assert.Equal(t, checks.StatusAnnotationProcessed, obj.GetAnnotations()[checks.StatusAnnotation])
	assert.Empty(t, obj.GetAnnotations()[checks.RetryAnnotation])
	assert.Empty(t, obj.Status.Report.Failures)
}

func TestProcessCheckRetry_Success(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{
		checks.RetryAnnotation:  "item",
		checks.StatusAnnotation: checks.StatusAnnotationProcessed,
	})
	obj.Status.Report.Failures = []advisorv0alpha1.CheckReportFailure{
		{
			ItemID: "item",
			StepID: "step",
		},
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{
		res: obj,
	}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	check := &mockCheck{
		items: []any{"item"},
	}

	err = processCheckRetry(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.NoError(t, err)
	assert.Equal(t, checks.StatusAnnotationProcessed, obj.GetAnnotations()[checks.StatusAnnotation])
	assert.Empty(t, obj.GetAnnotations()[checks.RetryAnnotation])
	assert.Empty(t, obj.Status.Report.Failures)
}

func TestProcessCheckRetry_Success_Polling(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{
		checks.RetryAnnotation:  "item",
		checks.StatusAnnotation: checks.StatusAnnotationProcessed,
	})
	obj.Status.Report.Failures = []advisorv0alpha1.CheckReportFailure{
		{
			ItemID: "item",
			StepID: "step",
		},
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	retryCount := 0
	client := &mockClient{
		get: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
			if retryCount > 0 {
				// obj contains the retry annotation
				return obj, nil
			}
			retryCount++
			oldObject := &advisorv0alpha1.Check{}
			oldObject.SetAnnotations(map[string]string{
				checks.RetryAnnotation: "",
			})
			return oldObject, nil
		},
	}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	check := &mockCheck{
		items: []any{"item"},
	}

	synctest.Test(t, func(t *testing.T) {
		err = processCheckRetry(ctx, logging.DefaultLogger, client, typesClient, obj, check)
		assert.NoError(t, err)
		assert.Equal(t, 1, retryCount)
	})
}

func TestProcessCheckRetry_PreservesOtherItemsFailures(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{
		checks.RetryAnnotation:  "item",
		checks.StatusAnnotation: checks.StatusAnnotationProcessed,
	})
	obj.Status.Report.Failures = []advisorv0alpha1.CheckReportFailure{
		{ItemID: "item", StepID: "step-item"},
		{ItemID: "other-item", StepID: "step-other"},
	}
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetCreatedBy("user:1")
	client := &mockClient{res: obj}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	check := &mockCheck{
		items: []any{"item"},
		// retry returns no failures for "item"
	}

	err = processCheckRetry(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.NoError(t, err)
	assert.Len(t, obj.Status.Report.Failures, 1)
	assert.Equal(t, "other-item", obj.Status.Report.Failures[0].ItemID)
	assert.Equal(t, "step-other", obj.Status.Report.Failures[0].StepID)
}

func TestProcessCheckRetry_AddsNewFailuresFromRetry(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{
		checks.RetryAnnotation:  "item",
		checks.StatusAnnotation: checks.StatusAnnotationProcessed,
	})
	obj.Status.Report.Failures = []advisorv0alpha1.CheckReportFailure{
		{ItemID: "item", StepID: "old-step"},
	}
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetCreatedBy("user:1")
	client := &mockClient{res: obj}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	check := &mockCheck{
		items: []any{"item"},
		retryFailures: []advisorv0alpha1.CheckReportFailure{
			{StepID: "new-step", Item: "new failure", ItemID: "item"},
		},
	}

	err = processCheckRetry(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.NoError(t, err)
	assert.Len(t, obj.Status.Report.Failures, 1)
	assert.Equal(t, "item", obj.Status.Report.Failures[0].ItemID)
	assert.Equal(t, "new-step", obj.Status.Report.Failures[0].StepID)
	assert.Equal(t, "new failure", obj.Status.Report.Failures[0].Item)
}

func TestProcessCheckRetry_AddsFailuresWhenNoneExisted(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{
		checks.RetryAnnotation:  "item",
		checks.StatusAnnotation: checks.StatusAnnotationProcessed,
	})
	// No existing failures for the retried item (empty Report.Failures)
	obj.Status.Report.Failures = []advisorv0alpha1.CheckReportFailure{}
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetCreatedBy("user:1")
	client := &mockClient{res: obj}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	check := &mockCheck{
		items: []any{"item"},
		retryFailures: []advisorv0alpha1.CheckReportFailure{
			{StepID: "retry-step", Item: "failure from retry", ItemID: "item"},
		},
	}

	err = processCheckRetry(ctx, logging.DefaultLogger, client, typesClient, obj, check)
	assert.NoError(t, err)
	assert.Len(t, obj.Status.Report.Failures, 1, "retry should add new failures when none existed")
	assert.Equal(t, "item", obj.Status.Report.Failures[0].ItemID)
	assert.Equal(t, "retry-step", obj.Status.Report.Failures[0].StepID)
	assert.Equal(t, "failure from retry", obj.Status.Report.Failures[0].Item)
}

func newRetryAdmissionObj(t *testing.T, stored *advisorv0alpha1.Check, item string) *advisorv0alpha1.Check {
	obj := stored.DeepCopy()
	obj.SetAnnotations(map[string]string{
		checks.RetryAnnotation:  item,
		checks.StatusAnnotation: checks.StatusAnnotationProcessed,
	})
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetCreatedBy("user:1")
	return obj
}

func TestProcessCheckRetry_OverlappingRetries(t *testing.T) {
	stored := &advisorv0alpha1.Check{}
	stored.SetAnnotations(map[string]string{
		checks.StatusAnnotation: checks.StatusAnnotationProcessed,
	})
	stored.Status.Report.Count = 3
	stored.Status.Report.Failures = []advisorv0alpha1.CheckReportFailure{
		{ItemID: "a", StepID: "old"},
		{ItemID: "b", StepID: "old"},
		{ItemID: "c", StepID: "old"},
	}
	// Both admission objects carry the report from before either retry ran
	objA := newRetryAdmissionObj(t, stored, "a")
	objB := newRetryAdmissionObj(t, stored, "b")
	// Retry "b" was requested right after "a" and overwrote the shared annotation
	stored.SetAnnotations(objB.GetAnnotations())
	client := &statefulClient{stored: stored}
	typesClient := &mockTypesClient{}
	ctx := context.TODO()

	synctest.Test(t, func(t *testing.T) {
		checkA := &mockCheck{items: []any{"a"}, retryFailures: []advisorv0alpha1.CheckReportFailure{{ItemID: "a", StepID: "new"}}}
		err := processCheckRetry(ctx, logging.DefaultLogger, client, typesClient, objA, checkA)
		require.NoError(t, err, "a superseded retry must not fail")
		assert.Equal(t, "b", checks.GetRetryAnnotation(client.current()), "retry a must not clear the annotation of retry b")

		checkB := &mockCheck{items: []any{"b"}, retryFailures: []advisorv0alpha1.CheckReportFailure{{ItemID: "b", StepID: "new"}}}
		err = processCheckRetry(ctx, logging.DefaultLogger, client, typesClient, objB, checkB)
		require.NoError(t, err)

		final := client.current()
		assert.Empty(t, checks.GetRetryAnnotation(final))
		assert.Equal(t, checks.StatusAnnotationProcessed, checks.GetStatusAnnotation(final))
		assert.Equal(t, int64(3), final.Status.Report.Count)
		assert.ElementsMatch(t, []advisorv0alpha1.CheckReportFailure{
			{ItemID: "c", StepID: "old"},
			{ItemID: "a", StepID: "new"},
			{ItemID: "b", StepID: "new"},
		}, final.Status.Report.Failures)
	})
}

func TestProcessCheckRetry_OverlappingRetries_Concurrent(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		stored := &advisorv0alpha1.Check{}
		stored.SetAnnotations(map[string]string{
			checks.RetryAnnotation:  "b",
			checks.StatusAnnotation: checks.StatusAnnotationProcessed,
		})
		stored.Status.Report.Failures = []advisorv0alpha1.CheckReportFailure{
			{ItemID: "a", StepID: "old"},
			{ItemID: "b", StepID: "old"},
		}

		objA := newRetryAdmissionObj(t, stored, "a")
		objB := newRetryAdmissionObj(t, stored, "b")

		client := &statefulClient{stored: stored}
		typesClient := &mockTypesClient{}

		checkA := &mockCheck{items: []any{"a"}, retryFailures: []advisorv0alpha1.CheckReportFailure{{ItemID: "a", StepID: "new"}}}
		retryAErr := make(chan error, 1)
		go func() {
			retryAErr <- processCheckRetry(t.Context(), logging.DefaultLogger, client, typesClient, objA, checkA)
		}()

		// Let retry A observe B's annotation before B can clear it.
		synctest.Wait()

		assert.Empty(t, retryAErr, "retry A should still be polling")

		checkB := &mockCheck{items: []any{"b"}, retryFailures: []advisorv0alpha1.CheckReportFailure{{ItemID: "b", StepID: "new"}}}
		errB := processCheckRetry(t.Context(), logging.DefaultLogger, client, typesClient, objB, checkB)
		errA := <-retryAErr

		require.NoError(t, errB, "retry B")
		require.NoError(t, errA, "retry A")

		final := client.current()
		assert.Empty(t, checks.GetRetryAnnotation(final))
		assert.ElementsMatch(t, []advisorv0alpha1.CheckReportFailure{
			{ItemID: "a", StepID: "new"},
			{ItemID: "b", StepID: "new"},
		}, final.Status.Report.Failures)
	})
}

func TestWaitForRetryAnnotation_Superseded(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	gets := 0
	client := &mockClient{
		get: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
			gets++
			current := &advisorv0alpha1.Check{}
			current.SetAnnotations(map[string]string{checks.RetryAnnotation: fmt.Sprintf("other-%d", gets)})
			return current, nil
		},
	}

	synctest.Test(t, func(t *testing.T) {
		err := waitForRetryAnnotation(context.TODO(), logging.DefaultLogger, client, obj, "item")
		assert.NoError(t, err)
		assert.Equal(t, 6, gets, "should keep polling for its own annotation before giving up")
	})
}

func TestWaitForRetryAnnotation_NeverSet(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	client := &mockClient{res: &advisorv0alpha1.Check{}}

	synctest.Test(t, func(t *testing.T) {
		err := waitForRetryAnnotation(context.TODO(), logging.DefaultLogger, client, obj, "item")
		assert.Error(t, err)
	})
}

func TestRunStepsInParallel_ConcurrentHeaderAccess(t *testing.T) {
	// Create an HTTP request with headers to simulate the real scenario
	req, err := http.NewRequest("GET", "/test", nil)
	require.NoError(t, err)
	req.Header.Set("X-Test-Header", "test-value")
	req.Header.Set("X-Panel-Id", "123")
	req.Header.Set("Cookie", "session=abc123; user_pref=dark")

	// Create a context with ReqContext that includes the HTTP request
	webCtx := &web.Context{
		Req: req,
	}
	reqCtx := &contextmodel.ReqContext{
		Context:      webCtx,
		SignedInUser: &user.SignedInUser{},
	}

	ctx := ctxkey.Set(context.Background(), reqCtx)

	// Create steps that modify headers concurrently (simulating CookiesMiddleware behavior)
	steps := []checks.Step{
		&headerModifyingStep{headerName: "X-Test-Header", headerValue: "modified-1"},
		&headerModifyingStep{headerName: "Cookie", headerValue: "session=xyz456"},
		&headerModifyingStep{headerName: "X-Panel-Id", headerValue: "456"},
	}

	// Create multiple items to process
	const numItems = 20
	items := make([]any, numItems)
	for i := range numItems {
		items[i] = fmt.Sprintf("item-%d", i)
	}

	// Track panics that might occur during execution
	var panicCount int32
	originalPanicHandler := func() {
		if r := recover(); r != nil {
			panicCount++
			t.Errorf("Unexpected panic during concurrent header access: %v", r)
		}
	}

	// This test should not panic with our fix
	t.Run("should not panic with concurrent header modifications", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				originalPanicHandler()
			}
		}()

		originalHeaders := req.Header.Clone()
		synctest.Test(t, func(t *testing.T) {
			failures, err := runStepsInParallel(ctx, logging.DefaultLogger, nil, steps, items)

			// Verify no error occurred
			assert.NoError(t, err)
			// Should have no failures since our mock step doesn't report failures
			assert.Empty(t, failures)
			// Verify no panics occurred
			assert.Equal(t, int32(0), panicCount)
			assert.Equal(t, originalHeaders, req.Header)
		})
	})
}

type mockClient struct {
	resource.Client
	values []any
	res    resource.Object
	get    func(ctx context.Context, id resource.Identifier) (resource.Object, error)
}

func (m *mockClient) PatchInto(ctx context.Context, id resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions, obj resource.Object) error {
	value := req.Operations[0].Value
	m.values = append(m.values, value)
	return nil
}

func (m *mockClient) Get(ctx context.Context, id resource.Identifier) (resource.Object, error) {
	if m.get != nil {
		return m.get(ctx, id)
	}
	return m.res, nil
}

// statefulClient keeps a single stored Check and applies patches to it, like the apiserver
type statefulClient struct {
	resource.Client
	mu     sync.Mutex
	stored *advisorv0alpha1.Check
}

func (s *statefulClient) current() *advisorv0alpha1.Check {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stored.DeepCopy()
}

func (s *statefulClient) Get(ctx context.Context, id resource.Identifier) (resource.Object, error) {
	return s.current(), nil
}

func (s *statefulClient) PatchInto(ctx context.Context, id resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions, obj resource.Object) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	op := req.Operations[0]
	switch op.Path {
	case "/metadata/annotations":
		s.stored.SetAnnotations(maps.Clone(op.Value.(map[string]string)))
	case "/status":
		status := op.Value.(advisorv0alpha1.CheckStatus)
		var cpy advisorv0alpha1.CheckStatus
		status.DeepCopyInto(&cpy)
		s.stored.Status = cpy
	default:
		return fmt.Errorf("unexpected patch path %s", op.Path)
	}
	return nil
}

type mockTypesClient struct {
	resource.Client
	res resource.Object
}

func (m *mockTypesClient) Get(ctx context.Context, id resource.Identifier) (resource.Object, error) {
	if m.res == nil {
		return advisorv0alpha1.CheckTypeKind().ZeroValue(), nil
	}
	return m.res, nil
}

type mockCheck struct {
	err           error
	items         []any
	runPanics     bool
	retryFailures []advisorv0alpha1.CheckReportFailure // if set, step Run returns these (for retry tests)
}

func (m *mockCheck) ID() string {
	return "mock"
}

func (m *mockCheck) Name() string {
	return "Mock"
}

func (m *mockCheck) Items(ctx context.Context) ([]any, error) {
	return m.items, nil
}

func (m *mockCheck) Item(ctx context.Context, id string) (any, error) {
	return m.items[0], nil
}

func (m *mockCheck) Init(ctx context.Context) error {
	return nil
}

func (m *mockCheck) Steps() []checks.Step {
	return []checks.Step{
		&mockStep{err: m.err, panics: m.runPanics, failures: m.retryFailures},
	}
}

type mockStep struct {
	err      error
	panics   bool
	failures []advisorv0alpha1.CheckReportFailure // when non-nil, returned from Run (for retry tests)
}

func (m *mockStep) Run(ctx context.Context, log logging.Logger, obj *advisorv0alpha1.CheckSpec, items any) ([]advisorv0alpha1.CheckReportFailure, error) {
	if m.panics {
		panic("panic")
	}
	if m.err != nil {
		return nil, m.err
	}
	if m.failures != nil {
		return m.failures, nil
	}
	if _, ok := items.(error); ok {
		return []advisorv0alpha1.CheckReportFailure{{}}, nil
	}
	return nil, nil
}

func (m *mockStep) Title() string {
	return "mock"
}

func (m *mockStep) Description() string {
	return "mock"
}

func (m *mockStep) Resolution() string {
	return "mock"
}

func (m *mockStep) ID() string {
	return "mock"
}

// headerModifyingStep is a mock step that modifies HTTP headers to simulate
// the behavior of CookiesMiddleware and other middleware that caused the original panic
type headerModifyingStep struct {
	headerName  string
	headerValue string
}

func (h *headerModifyingStep) Run(ctx context.Context, log logging.Logger, obj *advisorv0alpha1.CheckSpec, item any) ([]advisorv0alpha1.CheckReportFailure, error) {
	// Get the request context and modify headers (this used to cause panics)
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx != nil && reqCtx.Req != nil {
		// This is the type of header modification that was causing the concurrent map access panic
		reqCtx.Req.Header.Set(h.headerName, h.headerValue)
		reqCtx.Req.Header.Add("X-Processed-By", h.ID())

		// Also test header deletion like ClearCookieHeader does
		if h.headerName == "Cookie" {
			reqCtx.Req.Header.Del("Cookie")
			reqCtx.Req.Header.Set("Cookie", h.headerValue)
		}

		// Test reading headers as well
		_ = reqCtx.Req.Header.Get("X-Test-Header")
		_ = reqCtx.Req.Header.Get("X-Panel-Id")
	}

	// No failures to report
	return nil, nil
}

func (h *headerModifyingStep) Title() string {
	return "Header Modifying Step"
}

func (h *headerModifyingStep) Description() string {
	return "A mock step that modifies HTTP headers to test concurrent access"
}

func (h *headerModifyingStep) Resolution() string {
	return "This is a test step"
}

func (h *headerModifyingStep) ID() string {
	return fmt.Sprintf("header-modifier-%s", h.headerName)
}
