package provisioning

import (
	"context"
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
//
// Flake-hardening notes:
//
//   - A narrow empty-cache fallback in BuildConditionPatchOpsFromExisting can
//     still emit a whole-array `replace /status/conditions` if the controller's
//     informer sees an empty array right after the first write. The tests below
//     are written to be idempotent across that window: they re-apply adds and
//     re-read state inside EventuallyWithT until a stable expected state is
//     observed.
//   - All `require.*` calls that might be reached from a goroutine or from a
//     retry callback are moved to the test goroutine; concurrent retry loops
//     return errors via channels instead of failing inline.

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

	// Wait for the controller to populate Ready and NamespaceQuota so we have
	// a stable snapshot and so the informer cache has caught up enough that
	// subsequent reconciles use per-condition ops (not the empty-array
	// fallback that would whole-array replace).
	waitForConditionTypes(t, helper, repoName,
		provisioning.ConditionTypeReady,
		provisioning.ConditionTypeNamespaceQuota,
	)

	before := getRepositoryConditions(t, helper, repoName)
	existingTypes := conditionTypeSet(before)
	require.Contains(t, existingTypes, provisioning.ConditionTypeReady, "Ready must be present after waitForConditionTypes")
	require.NotContains(t, existingTypes, provisioning.ConditionTypePullStatus, "PullStatus should not yet exist; the sync worker writes it")

	pullStatus := metav1.Condition{
		Type:               provisioning.ConditionTypePullStatus,
		Status:             metav1.ConditionTrue,
		Reason:             provisioning.ReasonSuccess,
		Message:            "Pull completed successfully",
		LastTransitionTime: metav1.NewTime(time.Now()),
		ObservedGeneration: 1,
	}
	addPullStatus := mustMarshalJSONPatch(t, []map[string]any{
		{"op": "add", "path": "/status/conditions/-", "value": pullStatus},
	})

	// Idempotent apply-and-verify: if the narrow empty-cache race does
	// clobber our append, the next iteration re-adds PullStatus and re-checks.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		cur, err := readRepositoryConditions(ctx, helper, repoName)
		if !assert.NoError(c, err) {
			return
		}
		curTypes := conditionTypeSet(cur)

		if _, has := curTypes[provisioning.ConditionTypePullStatus]; !has {
			_, err := helper.Repositories.Resource.Patch(ctx, repoName, types.JSONPatchType, addPullStatus, metav1.PatchOptions{}, "status")
			assert.NoError(c, err, "add /status/conditions/- should succeed against status subresource")
			return
		}

		for typ := range existingTypes {
			assert.Contains(c, curTypes, typ, "condition %q was clobbered by the append", typ)
		}
		found := common.FindCondition(cur, provisioning.ConditionTypePullStatus)
		if !assert.NotNil(c, found, "PullStatus should be present after `add /-`") {
			return
		}
		assert.Equal(c, metav1.ConditionTrue, found.Status)
		assert.Equal(c, provisioning.ReasonSuccess, found.Reason)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"PullStatus should eventually be present alongside existing conditions")
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

	// Wait for the controller to populate Ready and NamespaceQuota so we have
	// a stable snapshot and so the informer cache has caught up enough that
	// subsequent reconciles use per-condition ops (not the empty-array
	// fallback that would whole-array replace).
	waitForConditionTypes(t, helper, repoName,
		provisioning.ConditionTypeReady,
		provisioning.ConditionTypeNamespaceQuota,
	)

	initial := metav1.Condition{
		Type:               provisioning.ConditionTypePullStatus,
		Status:             metav1.ConditionFalse,
		Reason:             provisioning.ReasonFailure,
		Message:            "Pull completed with errors",
		LastTransitionTime: metav1.NewTime(time.Now().Add(-time.Minute)),
		ObservedGeneration: 1,
	}
	seedPullStatus := mustMarshalJSONPatch(t, []map[string]any{
		{"op": "add", "path": "/status/conditions/-", "value": initial},
	})

	replacement := metav1.Condition{
		Type:               provisioning.ConditionTypePullStatus,
		Status:             metav1.ConditionTrue,
		Reason:             provisioning.ReasonSuccess,
		Message:            "Pull completed successfully",
		LastTransitionTime: metav1.NewTime(time.Now()),
		ObservedGeneration: 1,
	}

	// Single retry loop: find PullStatus (adding it first if the empty-cache
	// race has wiped it), then replace it in place by index, then verify.
	// Everything is re-read fresh from the apiserver each iteration so a
	// shift in the array between reads is self-healing.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		cur, err := readRepositoryConditions(ctx, helper, repoName)
		if !assert.NoError(c, err) {
			return
		}

		idx := indexOfConditionType(cur, provisioning.ConditionTypePullStatus)
		if idx < 0 {
			_, err := helper.Repositories.Resource.Patch(ctx, repoName, types.JSONPatchType, seedPullStatus, metav1.PatchOptions{}, "status")
			assert.NoError(c, err, "seeding PullStatus should succeed")
			return
		}

		// Snapshot non-target entries before the replace so we can verify
		// they are untouched. Re-read immediately after the replace.
		beforeReplace := append([]metav1.Condition(nil), cur...)

		replacePatch, err := json.Marshal([]map[string]any{
			{"op": "replace", "path": fmt.Sprintf("/status/conditions/%d", idx), "value": replacement},
		})
		if !assert.NoError(c, err) {
			return
		}
		_, err = helper.Repositories.Resource.Patch(ctx, repoName, types.JSONPatchType, replacePatch, metav1.PatchOptions{}, "status")
		if !assert.NoError(c, err, "replace /status/conditions/%d should succeed", idx) {
			return
		}

		after, err := readRepositoryConditions(ctx, helper, repoName)
		if !assert.NoError(c, err) {
			return
		}
		if !assert.Len(c, after, len(beforeReplace), "replace must not change the array length") {
			return
		}

		// Target must reflect the new values; non-targets must be unchanged.
		// The controller may re-touch Ready/Quota in the gap, so we only
		// compare non-target *types* (and PullStatus value), not the full
		// condition payload.
		if !assert.Equal(c, provisioning.ConditionTypePullStatus, after[idx].Type) {
			return
		}
		assert.Equal(c, metav1.ConditionTrue, after[idx].Status, "replaced condition should now be True")
		assert.Equal(c, provisioning.ReasonSuccess, after[idx].Reason, "replaced condition should have new reason")
		for i, cond := range after {
			if i == idx {
				continue
			}
			assert.Equal(c, beforeReplace[i].Type, cond.Type, "non-target condition type must not move")
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"replace /status/conditions/{idx} should succeed and leave non-target entries untouched")
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

	// Wait for the controller to populate Ready and NamespaceQuota so we have
	// a stable snapshot and so the informer cache has caught up enough that
	// subsequent reconciles use per-condition ops (not the empty-array
	// fallback that would whole-array replace).
	waitForConditionTypes(t, helper, repoName,
		provisioning.ConditionTypeReady,
		provisioning.ConditionTypeNamespaceQuota,
	)

	// Neutral condition types the controller/sync-worker never touch.
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

	// Pre-marshal on the test goroutine so require-via-marshal is not reached
	// from a worker goroutine.
	patchA := mustMarshalJSONPatch(t, []map[string]any{
		{"op": "add", "path": "/status/conditions/-", "value": condA},
	})
	patchB := mustMarshalJSONPatch(t, []map[string]any{
		{"op": "add", "path": "/status/conditions/-", "value": condB},
	})

	// Each goroutine loops until its condition type is present in the
	// repository's conditions. This absorbs both apiserver write conflicts
	// and the narrow empty-cache clobber window.
	var wg sync.WaitGroup
	wg.Add(2)
	errs := make(chan error, 2)
	deadline := time.Now().Add(common.WaitTimeoutDefault)

	ensurePresent := func(patch []byte, conditionType string) {
		defer wg.Done()
		for time.Now().Before(deadline) {
			cur, err := readRepositoryConditions(ctx, helper, repoName)
			if err == nil && indexOfConditionType(cur, conditionType) >= 0 {
				errs <- nil
				return
			}
			if _, perr := helper.Repositories.Resource.Patch(ctx, repoName, types.JSONPatchType, patch, metav1.PatchOptions{}, "status"); perr != nil {
				// Retry on conflict / transient errors; fall through to sleep.
				_ = perr
			}
			time.Sleep(common.WaitIntervalDefault)
		}
		errs <- fmt.Errorf("condition %q was never observed after repeated `add /-` attempts", conditionType)
	}

	go ensurePresent(patchA, condA.Type)
	go ensurePresent(patchB, condB.Type)
	wg.Wait()
	close(errs)
	for e := range errs {
		require.NoError(t, e, "concurrent `add /-` writers must eventually succeed")
	}

	// Final steady-state check: both neutral conditions must be present
	// simultaneously (not just individually-eventually).
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		cur, err := readRepositoryConditions(ctx, helper, repoName)
		if !assert.NoError(c, err) {
			return
		}
		types := conditionTypeSet(cur)
		assert.Contains(c, types, condA.Type, "actor A's condition missing; a concurrent writer clobbered it")
		assert.Contains(c, types, condB.Type, "actor B's condition missing; a concurrent writer clobbered it")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"both neutral conditions must coexist in the conditions array")
}

// waitForConditionTypes blocks until every named condition type is present on
// the repository. Used to make sure the controller has written its initial
// batch (Ready + Quota) and the informer cache has caught up before the test
// starts mutating /status/conditions.
func waitForConditionTypes(t *testing.T, helper *common.ProvisioningTestHelper, name string, conditionTypes ...string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		cur, err := readRepositoryConditions(t.Context(), helper, name)
		if !assert.NoError(c, err) {
			return
		}
		have := conditionTypeSet(cur)
		for _, typ := range conditionTypes {
			assert.Contains(c, have, typ, "repository %q still missing condition %q", name, typ)
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"repository %q should have conditions %v", name, conditionTypes)
}

// getRepositoryConditions is a require-based helper intended for the test
// goroutine only. Inside retry callbacks and worker goroutines, use
// readRepositoryConditions instead — it returns errors without calling
// t.FailNow, which is illegal off the test goroutine.
func getRepositoryConditions(t *testing.T, helper *common.ProvisioningTestHelper, name string) []metav1.Condition {
	t.Helper()
	cur, err := readRepositoryConditions(t.Context(), helper, name)
	require.NoError(t, err, "failed to get repository %q", name)
	return cur
}

func readRepositoryConditions(ctx context.Context, helper *common.ProvisioningTestHelper, name string) ([]metav1.Condition, error) {
	obj, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	repo, err := common.FromUnstructured[provisioning.Repository](obj)
	if err != nil {
		return nil, err
	}
	return repo.Status.Conditions, nil
}

func conditionTypeSet(conditions []metav1.Condition) map[string]struct{} {
	out := make(map[string]struct{}, len(conditions))
	for _, c := range conditions {
		out[c.Type] = struct{}{}
	}
	return out
}

func indexOfConditionType(conditions []metav1.Condition, conditionType string) int {
	for i, c := range conditions {
		if c.Type == conditionType {
			return i
		}
	}
	return -1
}

func mustMarshalJSONPatch(t *testing.T, ops []map[string]any) []byte {
	t.Helper()
	b, err := json.Marshal(ops)
	require.NoError(t, err, "failed to marshal JSON patch")
	return b
}
