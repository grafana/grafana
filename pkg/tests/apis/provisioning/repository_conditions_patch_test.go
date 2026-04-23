package provisioning

import (
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// These tests exercise the per-condition JSON Patch shape that the Repository
// controller and sync worker use to write `/status/conditions`. The production
// code path (BuildConditionPatchOpsFromExisting) emits:
//
//   - `add /status/conditions/-`          for brand-new condition types
//   - `replace /status/conditions/{idx}`  for condition types that already exist
//
// They intentionally DO NOT emit a whole-array `replace /status/conditions` when
// the array is non-empty, because a stale whole-array replace by one actor can
// clobber conditions written concurrently by another actor. These tests hit the
// live apiserver with those exact ops so regressions in apiserver handling (or
// our understanding of JSON Patch semantics against the status subresource) are
// caught.

func TestIntegrationProvisioning_ConditionsPatch_AppendDoesNotClobber(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := sharedHelper(t)
	ctx := t.Context()

	const repoName = "cond-patch-append"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repoName,
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	// After creation the controller writes Ready (and typically Quota) on /status/conditions.
	// Snapshot the current conditions before we touch the array.
	before := getRepositoryConditions(t, helper, repoName)
	require.NotEmpty(t, before, "controller should have populated at least one condition before patching")
	existingTypes := conditionTypeSet(before)
	require.Contains(t, existingTypes, provisioning.ConditionTypeReady, "Ready condition must be present for this test to be meaningful")
	require.NotContains(t, existingTypes, provisioning.ConditionTypePullStatus, "PullStatus should not yet exist; the sync worker writes it")

	// Append PullStatus via `add /-`. This is the exact shape the sync worker
	// emits when PullStatus is a brand-new condition type on the repo.
	pullStatus := metav1.Condition{
		Type:               provisioning.ConditionTypePullStatus,
		Status:             metav1.ConditionTrue,
		Reason:             provisioning.ReasonSuccess,
		Message:            "Pull completed successfully",
		LastTransitionTime: metav1.NewTime(time.Now()),
		ObservedGeneration: 1,
	}
	patch := mustMarshalJSONPatch(t, []map[string]interface{}{
		{"op": "add", "path": "/status/conditions/-", "value": pullStatus},
	})
	_, err := helper.Repositories.Resource.Patch(ctx, repoName, types.JSONPatchType, patch, metav1.PatchOptions{}, "status")
	require.NoError(t, err, "add /status/conditions/- should succeed against the status subresource")

	// After the append: all prior condition types must still be present AND the new PullStatus
	// must be there. This is the property the fix relies on.
	after := getRepositoryConditions(t, helper, repoName)
	afterTypes := conditionTypeSet(after)
	for typ := range existingTypes {
		require.Contains(t, afterTypes, typ, "condition %q was clobbered by the append", typ)
	}
	require.Contains(t, afterTypes, provisioning.ConditionTypePullStatus, "PullStatus should be present after `add /-`")

	appended := common.FindCondition(after, provisioning.ConditionTypePullStatus)
	require.NotNil(t, appended)
	require.Equal(t, metav1.ConditionTrue, appended.Status)
	require.Equal(t, provisioning.ReasonSuccess, appended.Reason)
}

func TestIntegrationProvisioning_ConditionsPatch_ReplaceByIndex(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := sharedHelper(t)
	ctx := t.Context()

	const repoName = "cond-patch-replace"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repoName,
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	// Seed a PullStatus condition so we have a stable, controller-untouched entry to replace.
	initial := metav1.Condition{
		Type:               provisioning.ConditionTypePullStatus,
		Status:             metav1.ConditionFalse,
		Reason:             provisioning.ReasonFailure,
		Message:            "Pull completed with errors",
		LastTransitionTime: metav1.NewTime(time.Now().Add(-time.Minute)),
		ObservedGeneration: 1,
	}
	seedPatch := mustMarshalJSONPatch(t, []map[string]interface{}{
		{"op": "add", "path": "/status/conditions/-", "value": initial},
	})
	_, err := helper.Repositories.Resource.Patch(ctx, repoName, types.JSONPatchType, seedPatch, metav1.PatchOptions{}, "status")
	require.NoError(t, err, "seeding PullStatus should succeed")

	// Locate the PullStatus index.
	before := getRepositoryConditions(t, helper, repoName)
	pullStatusIdx := -1
	for i, c := range before {
		if c.Type == provisioning.ConditionTypePullStatus {
			pullStatusIdx = i
			break
		}
	}
	require.GreaterOrEqual(t, pullStatusIdx, 0, "PullStatus index should be discoverable after the add")

	// Replace only the PullStatus entry by index.
	replacement := metav1.Condition{
		Type:               provisioning.ConditionTypePullStatus,
		Status:             metav1.ConditionTrue,
		Reason:             provisioning.ReasonSuccess,
		Message:            "Pull completed successfully",
		LastTransitionTime: metav1.NewTime(time.Now()),
		ObservedGeneration: 1,
	}
	replacePatch := mustMarshalJSONPatch(t, []map[string]interface{}{
		{"op": "replace", "path": fmt.Sprintf("/status/conditions/%d", pullStatusIdx), "value": replacement},
	})
	_, err = helper.Repositories.Resource.Patch(ctx, repoName, types.JSONPatchType, replacePatch, metav1.PatchOptions{}, "status")
	require.NoError(t, err, "replace /status/conditions/%d should succeed", pullStatusIdx)

	after := getRepositoryConditions(t, helper, repoName)
	require.Len(t, after, len(before), "replace must not change the array length")

	// The replaced entry must reflect the new values; every other entry must be byte-identical
	// (aside from ObservedGeneration, which the controller may bump in between polls).
	for i, c := range after {
		if i == pullStatusIdx {
			assert.Equal(t, metav1.ConditionTrue, c.Status, "replaced condition should now be True")
			assert.Equal(t, provisioning.ReasonSuccess, c.Reason, "replaced condition should have new reason")
			continue
		}
		assert.Equal(t, before[i].Type, c.Type, "non-target condition type must not move")
		assert.Equal(t, before[i].Status, c.Status, "non-target condition status must not change")
		assert.Equal(t, before[i].Reason, c.Reason, "non-target condition reason must not change")
	}
}

// TestIntegrationProvisioning_ConditionsPatch_ConcurrentAdds covers the race that
// motivated the fix: two writers with stale-but-consistent views each apply
// `add /-` for a brand-new condition type. With per-condition ops, both writes
// land without either one clobbering the other. A whole-array `replace` built
// from a stale snapshot would silently erase whichever condition wasn't in that
// snapshot.
func TestIntegrationProvisioning_ConditionsPatch_ConcurrentAdds(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := sharedHelper(t)
	ctx := t.Context()

	const repoName = "cond-patch-concurrent"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repoName,
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	// Two condition types that the controller/sync-worker will not touch on a skipped-sync repo.
	// We pick neutral types so the background reconciliation loop doesn't race our assertions.
	condA := metav1.Condition{
		Type:               "ConcurrentPatchTestA",
		Status:             metav1.ConditionTrue,
		Reason:             "TestA",
		Message:            "actor A wrote this",
		LastTransitionTime: metav1.NewTime(time.Now()),
	}
	condB := metav1.Condition{
		Type:               "ConcurrentPatchTestB",
		Status:             metav1.ConditionTrue,
		Reason:             "TestB",
		Message:            "actor B wrote this",
		LastTransitionTime: metav1.NewTime(time.Now()),
	}

	var wg sync.WaitGroup
	wg.Add(2)
	errs := make(chan error, 2)

	apply := func(cond metav1.Condition) {
		defer wg.Done()
		patch := mustMarshalJSONPatch(t, []map[string]interface{}{
			{"op": "add", "path": "/status/conditions/-", "value": cond},
		})
		// Retry briefly on transient conflicts; `add /-` should normally succeed
		// against the status subresource without resourceVersion, but apiserver
		// retries on write conflicts are still possible on shared backends.
		var lastErr error
		for range 10 {
			_, err := helper.Repositories.Resource.Patch(ctx, repoName, types.JSONPatchType, patch, metav1.PatchOptions{}, "status")
			if err == nil {
				errs <- nil
				return
			}
			lastErr = err
			time.Sleep(50 * time.Millisecond)
		}
		errs <- lastErr
	}

	go apply(condA)
	go apply(condB)
	wg.Wait()
	close(errs)
	for e := range errs {
		require.NoError(t, e, "concurrent `add /-` patches must all succeed")
	}

	// Both conditions must be present after both writes — that's the no-clobber guarantee.
	after := getRepositoryConditions(t, helper, repoName)
	types := conditionTypeSet(after)
	require.Contains(t, types, "ConcurrentPatchTestA", "actor A's condition is missing; a concurrent writer clobbered it")
	require.Contains(t, types, "ConcurrentPatchTestB", "actor B's condition is missing; a concurrent writer clobbered it")
}

func getRepositoryConditions(t *testing.T, helper *common.ProvisioningTestHelper, name string) []metav1.Condition {
	t.Helper()
	obj, err := helper.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.NoError(t, err, "failed to get repository %q", name)
	repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
	return repo.Status.Conditions
}

func conditionTypeSet(conditions []metav1.Condition) map[string]struct{} {
	out := make(map[string]struct{}, len(conditions))
	for _, c := range conditions {
		out[c.Type] = struct{}{}
	}
	return out
}

func mustMarshalJSONPatch(t *testing.T, ops []map[string]interface{}) []byte {
	t.Helper()
	b, err := json.Marshal(ops)
	require.NoError(t, err, "failed to marshal JSON patch")
	return b
}
