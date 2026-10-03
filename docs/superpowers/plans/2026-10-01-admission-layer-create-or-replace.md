# Admission-Layer Create-or-Replace (Track 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a sentinel-resourceVersion Create against an existing dashboard actually run dashboard's real Update-flavored admission validation (not Create-flavored), closing the gap the prior review found, while fixing the storage-layer bugs that review also found.

**Architecture:** A new admission-layer wrapper around the already-assembled admission chain (`pkg/services/apiserver/appinstaller.RegisterAdmission`) detects the sentinel, fetches the existing object via a per-resource opt-in `APIGroupGetter`, and re-dispatches to the chain with synthetic `Operation: Update` attributes. On success it stamps an internal marker the storage layer (`apistore.Storage.createOrReplace`, already on this branch) now requires before it will actually replace anything — closing the fail-open gap and making the whole mechanism correct end-to-end for dashboards.

**Tech Stack:** Go, `k8s.io/apiserver/pkg/admission`, Grafana's `pkg/services/apiserver/builder` and `pkg/services/apiserver/appinstaller`, `pkg/storage/unified/apistore` (existing), `pkg/apimachinery/utils`.

**Spec:** `docs/superpowers/specs/2026-10-01-generic-create-or-replace-resourceversion-design.md`

## Global Constraints

- Track 2 (app-sdk-native `AppInstaller` apps) is explicitly out of scope — no changes to `grafana-app-sdk`, no changes aimed at the alerting historian or any other app-sdk-native app.
- Folders are explicitly out of scope — no `APIGroupGetter` implementation for folders, no folder test.
- Quota admission, the `ManagerKindTerraform`/`ManagerKindKubectl` `AllowsEdits` no-op, and the `terraform-provider-grafana` change are explicitly out of scope (unrelated pre-existing gaps, per the spec's non-goals).
- The sentinel value is `apistore.OverwriteOnCreateResourceVersion` (`"-1"`, already defined on this branch at `pkg/storage/unified/apistore/store.go`) — reuse it, don't redefine it elsewhere. No import-cycle risk: `pkg/services/apiserver/builder` and `pkg/services/apiserver/appinstaller` already import `pkg/storage/unified/apistore` directly (confirmed this session); `apistore` does not import either back.
- Every change to existing, already-passing tests on this branch must be a deliberate, test-first change with a stated reason — not a silent adjustment to make something pass.

## Review Focus

- **A sentinel-RV Create where the admission wrapper's old-object fetch itself fails** (not NotFound — e.g. a transport error) must propagate that error, not silently fall through to a plain create or swallow it. Covered in Task 5.
- **A client sets the internal marker annotation directly in their request body**, trying to skip admission's real check entirely. The admission wrapper's mutating phase must strip any client-supplied marker unconditionally before doing anything else, and only the wrapper itself may re-add it after a real synthetic re-dispatch succeeds. Covered in Task 5.
- **The `Admit` and `Validate` phases of the chain do not share a mutable `Attributes` instance** (confirmed this session by reading `k8s.io/apiserver/pkg/admission/chain.go` — `chainAdmissionHandler.Admit` and `.Validate` are independent top-level calls over the same slice of handlers; nothing threads state between them). The wrapper must redo sentinel-detection and synthetic-attributes construction independently in both its own `Admit` and `Validate` methods — a design that relies on one rewriting "for both" would silently only protect whichever phase it touched. Covered in Task 5.
- **A caller with update rights on the object but whose resource GV never registered an `APIGroupGetter`** must still get a plain 409 on a sentinel-RV create against an existing object — the mechanism must be provably a no-op for non-participating GVs, not just "untested for them." Covered in Task 6.
- **The existing (already-passing) storage-layer tests from the prior branch state silently stop testing what they claim to**, once the marker-gating requirement lands, because none of them go through admission and so none of them would have the marker set. Covered in Task 6 (every pre-existing `createOrReplace` test is updated to stamp the marker itself, simulating what admission would have done, so it keeps testing storage's behavior given a valid upstream decision).

---

## File Structure

- **Modify** `pkg/storage/unified/apistore/store.go` — `createOrReplace`'s `tryUpdate` closure (deep-copy fix) and its Get-then-Update shape (drop the pre-Get); add the marker-gating check.
- **Modify** `pkg/storage/unified/apistore/store_test.go` — fix the RBAC test's fake `AccessClient`, update the Get-error test's comment, stamp the marker in every existing `createOrReplace` test, add the new no-marker-still-409 test.
- **Modify** `pkg/apimachinery/utils/meta.go` — new marker annotation constant.
- **Modify** `pkg/services/apiserver/builder/common.go` — new `APIGroupGetter` interface.
- **Modify** `pkg/services/apiserver/builder/admission.go` — `builderAdmission` gains a `getters` map (kept for Track 1's own internal use is not actually needed here — see Task 3's note on where the map really needs to live).
- **Create** `pkg/services/apiserver/builder/getters.go` — `ExtractGetters(builders []APIGroupBuilder) map[schema.GroupVersion]APIGroupGetter`, mirroring `GetGroupVersions`'s existing pattern in `common.go`.
- **Modify** `pkg/registry/apis/dashboard/register.go` — `DashboardsAPIBuilder` implements `APIGroupGetter`.
- **Create** `pkg/services/apiserver/appinstaller/overwrite_admission.go` — the new wrapper type, its `Admit`/`Validate`, and the synthetic-attributes construction.
- **Modify** `pkg/services/apiserver/appinstaller/installer.go` — `RegisterAdmission` gains a `builders []builder.APIGroupBuilder` parameter and wraps its final chain.
- **Modify** `pkg/services/apiserver/service.go` — pass `builders` into the now-3-argument `RegisterAdmission` call.
- **Create** `pkg/tests/apis/dashboard/overwrite_admission_test.go` — real-apiserver integration test.

---

### Task 1: Storage-layer fixes — deep-copy per retry, drop the pre-Get race

**Files:**
- Modify: `pkg/storage/unified/apistore/store.go:407-421` (`createOrReplace`)
- Test: `pkg/storage/unified/apistore/store_test.go`

**Interfaces:**
- Consumes: `apistore.OverwriteOnCreateResourceVersion` (existing), `(s *Storage) GuaranteedUpdate(...)` (existing, confirmed signature: `GuaranteedUpdate(ctx context.Context, key string, destination runtime.Object, ignoreNotFound bool, preconditions *storage.Preconditions, tryUpdate storage.UpdateFunc, cachedExistingObject runtime.Object) error`, with its own upsert-on-missing branch at `store.go:797-818` that calls `s.Create` directly when `ignoreNotFound` is true and the object isn't found).
- Produces: `createOrReplace`'s new shape — no change to its own signature, just its body.

- [ ] **Step 1: Write the failing test proving the deep-copy matters**

Add to `store_test.go` (reuses `example.Pod`, `metav1`, `require`, `testSetup`, `apistore` — all already imported):

```go
func TestCreateOrReplaceDeepCopiesObjectPerRetryAttempt(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	require.NoError(t, err)

	key := "pods/test-ns/deepcopy-check"
	first := &example.Pod{ObjectMeta: metav1.ObjectMeta{Name: "deepcopy-check", Namespace: "test-ns"}}
	firstOut := &example.Pod{}
	require.NoError(t, store.Create(ctx, key, first, firstOut, 0))

	second := &example.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name: "deepcopy-check", Namespace: "test-ns", ResourceVersion: apistore.OverwriteOnCreateResourceVersion,
		},
		Spec: example.PodSpec{NodeName: "replacement-node"},
	}
	secondOut := &example.Pod{}
	require.NoError(t, store.Create(ctx, key, second, secondOut, 0))

	// The object passed in to Create must not have been mutated by the write it triggered -
	// if createOrReplace's tryUpdate ever returns the caller's own obj pointer instead of a
	// copy, storage-layer mutations (UID backfill, generation, etc.) leak back onto it.
	require.Empty(t, second.UID, "the caller's original object must never be mutated by the write")
}
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `go test ./pkg/storage/unified/apistore/... -run TestCreateOrReplaceDeepCopiesObjectPerRetryAttempt -v`

Expected: FAIL — `second.UID` is non-empty, because `tryUpdate` currently returns the same `obj` pointer `createOrReplace` was given, and `prepareObjectForUpdate` mutates it in place (sets UID from the previous object, among other fields).

- [ ] **Step 3: Implement both fixes together**

Replace `createOrReplace`'s current body:

```go
func (s *Storage) createOrReplace(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	existing := s.newFunc()
	err := s.Get(ctx, key, storage.GetOptions{}, existing)
	if storage.IsNotFound(err) {
		return s.Create(ctx, key, obj, out, ttl)
	}
	if err != nil {
		return err
	}

	tryUpdate := func(_ runtime.Object, _ storage.ResponseMeta) (runtime.Object, *uint64, error) {
		return obj, nil, nil
	}
	return s.GuaranteedUpdate(ctx, key, out, false, nil, tryUpdate, nil)
}
```

with:

```go
func (s *Storage) createOrReplace(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	tryUpdate := func(_ runtime.Object, _ storage.ResponseMeta) (runtime.Object, *uint64, error) {
		return obj.DeepCopyObject(), nil, nil
	}
	// ignoreNotFound: true means GuaranteedUpdate itself falls through to a plain Create
	// (see store.go's upsert-on-missing branch) when the object doesn't exist, so there's
	// no separate pre-Get here at all - removing both the extra round trip and the narrow
	// delete-between-Get-and-Update race a separate Get would otherwise open up.
	return s.GuaranteedUpdate(ctx, key, out, true, nil, tryUpdate, nil)
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `go test ./pkg/storage/unified/apistore/... -run TestCreateOrReplaceDeepCopiesObjectPerRetryAttempt -v`

Expected: PASS.

- [ ] **Step 5: Run the full existing `createOrReplace`/`Create` test set and read every failure**

Run: `go test ./pkg/storage/unified/apistore/... -run 'TestCreateOrReplace|TestCreate$|TestCreateWithKeyExist$' -v`

Expected: some failures here are real and expected at this point — `TestCreateOrReplaceRejectsUpdateWithoutUpdateRights` and `TestCreateOrReplaceGetErrorPropagatesUnchanged` were written against the old pre-Get shape and need updating (Task 2). `TestCreateOrReplaceCreatesWhenMissing`, `TestCreateOrReplaceReplacesWhenFound`, `TestCreateOrReplaceRejectsRepoManagedResource`, `TestCreateNonSentinelResourceVersionsUnchanged`, `TestCreate$`, and `TestCreateWithKeyExist$` must all still pass unchanged - if any of those fail, the fix in Step 3 is wrong, not the tests.

- [ ] **Step 6: Commit**

```bash
git add pkg/storage/unified/apistore/store.go pkg/storage/unified/apistore/store_test.go
git commit -m "apistore: deep-copy per retry and drop the pre-Get race in createOrReplace"
```

---

### Task 2: Fix the two tests Task 1 changed the shape under

**Files:**
- Test: `pkg/storage/unified/apistore/store_test.go`

**Interfaces:**
- Consumes: `createOrReplace`'s new shape (Task 1).

- [ ] **Step 1: Fix the RBAC test's fake AccessClient**

The current `createOnlyAccessClient` (allows only `VerbCreate`) was written to isolate "found, but lacks update rights" - but both the old pre-Get and the new internal read inside `GuaranteedUpdate` go through the same `authorizeRead`/get-style access check in `pkg/storage/unified/resource/server.go`'s `read` handler (confirmed this session), so a client denying everything except `VerbCreate` gets Forbidden from that internal read, not from the `VerbUpdate` check the test claims to prove, regardless of Task 1's change. Fix the fake to allow everything except `VerbUpdate`, so the only possible failure is the one check this test is actually about:

```go
func (createOnlyAccessClient) Check(_ context.Context, _ claims.AuthInfo, req claims.CheckRequest, _ string) (claims.CheckResponse, error) {
	return claims.CheckResponse{Allowed: req.Verb != utils.VerbUpdate}, nil
}
```

(`utils.VerbUpdate` and `utils.VerbCreate` are both already defined in `pkg/apimachinery/utils/verbs.go`; `utils` is already imported in this file.) Rename the type and test to reflect what it actually denies now:

```go
type denyUpdateAccessClient struct{}

func (denyUpdateAccessClient) Check(_ context.Context, _ claims.AuthInfo, req claims.CheckRequest, _ string) (claims.CheckResponse, error) {
	return claims.CheckResponse{Allowed: req.Verb != utils.VerbUpdate}, nil
}

func (denyUpdateAccessClient) Compile(_ context.Context, _ claims.AuthInfo, _ claims.ListRequest) (claims.ItemChecker, claims.Zookie, error) {
	return func(_, _ string) bool { return true }, &claims.NoopZookie{}, nil
}

func (denyUpdateAccessClient) BatchCheck(_ context.Context, _ claims.AuthInfo, req claims.BatchCheckRequest) (claims.BatchCheckResponse, error) {
	return claims.BatchCheckResponse{}, nil
}

func TestCreateOrReplaceRejectsUpdateWithoutUpdateRights(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t, withAccessClient(denyUpdateAccessClient{}))
	defer destroyFunc()
	require.NoError(t, err)

	key := "pods/test-ns/create-only"
	first := &example.Pod{ObjectMeta: metav1.ObjectMeta{Name: "create-only", Namespace: "test-ns"}}
	firstOut := &example.Pod{}
	require.NoError(t, store.Create(ctx, key, first, firstOut, 0), "every verb except update is allowed, so a genuine first create must still succeed")

	second := &example.Pod{ObjectMeta: metav1.ObjectMeta{
		Name: "create-only", Namespace: "test-ns", ResourceVersion: apistore.OverwriteOnCreateResourceVersion,
	}}
	secondOut := &example.Pod{}
	err = store.Create(ctx, key, second, secondOut, 0)
	require.Error(t, err, "the object exists, so this must now require VerbUpdate, which this AccessClient denies")
	require.True(t, apierrors.IsForbidden(err))
}
```

Delete the old `createOnlyAccessClient` type and its three methods entirely - don't leave both definitions in the file.

- [ ] **Step 2: Update the Get-error-propagation test's comment**

`TestCreateOrReplaceGetErrorPropagatesUnchanged`'s assertions and scenario (empty name, sentinel RV, expect a real non-NotFound error) still hold exactly as before - the error now propagates from `GuaranteedUpdate`'s own internal read (`store.go`'s `s.store.Read` call inside its retry loop) instead of a separate `createOrReplace`-level `Get`, but the propagation path (`resErr.Code != http.StatusNotFound -> return resource.GetError(resErr)`) is the same shape either way, with no code path that could swallow it silently. Update only the comment to stop describing a pre-Get that no longer exists:

```go
func TestCreateOrReplaceGetErrorPropagatesUnchanged(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	require.NoError(t, err)

	// An empty name produces a key the backend itself rejects when read - exercising
	// GuaranteedUpdate's own internal read-error propagation (inside its retry loop),
	// which createOrReplace now relies on directly having dropped its separate pre-Get.
	obj := &example.Pod{ObjectMeta: metav1.ObjectMeta{
		Name: "", Namespace: "test-ns", ResourceVersion: apistore.OverwriteOnCreateResourceVersion,
	}}
	out := &example.Pod{}
	err = store.Create(ctx, "pods/test-ns/", obj, out, 0)
	require.Error(t, err)
	require.False(t, storage.IsNotFound(err), "expected a real error to propagate, not be treated as NotFound and silently proceed to create")
}
```

- [ ] **Step 3: Run both, confirm pass**

Run: `go test ./pkg/storage/unified/apistore/... -run 'TestCreateOrReplaceRejectsUpdateWithoutUpdateRights|TestCreateOrReplaceGetErrorPropagatesUnchanged' -v`

Expected: PASS for both.

- [ ] **Step 4: Run the full package, confirm nothing else broke**

Run: `go test ./pkg/storage/unified/apistore/...`

Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add pkg/storage/unified/apistore/store_test.go
git commit -m "apistore: fix RBAC test to isolate VerbUpdate specifically"
```

---

### Task 3: `APIGroupGetter` interface + extraction helper

**Files:**
- Modify: `pkg/services/apiserver/builder/common.go` (new interface, next to `APIGroupMutation`/`APIGroupValidation`)
- Create: `pkg/services/apiserver/builder/getters.go`
- Test: `pkg/services/apiserver/builder/getters_test.go`

**Interfaces:**
- Produces: `builder.APIGroupGetter` interface (`Get(ctx context.Context, namespace, name string) (runtime.Object, error)`); `builder.ExtractGetters(builders []builder.APIGroupBuilder) map[schema.GroupVersion]builder.APIGroupGetter` — Task 7's `RegisterAdmission` change calls this directly.

- [ ] **Step 1: Write the failing test**

Create `pkg/services/apiserver/builder/getters_test.go`:

```go
package builder

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
)

// fakeBuilder satisfies the real APIGroupBuilder interface (common.go:30-50: InstallSchema,
// UpdateAPIGroupInfo, GetOpenAPIDefinitions, AllowedV0Alpha1Resources) plus
// APIGroupVersionProvider (GetGroupVersion, common.go:54-56), which GetGroupVersions needs.
// isGetter controls whether it also implements APIGroupGetter, to exercise both branches of
// ExtractGetters' type assertion.
type fakeBuilder struct {
	gv       schema.GroupVersion
	isGetter bool
	obj      runtime.Object
}

func (f *fakeBuilder) InstallSchema(*runtime.Scheme) error { return nil }
func (f *fakeBuilder) UpdateAPIGroupInfo(*genericapiserver.APIGroupInfo, APIGroupOptions) error {
	return nil
}
func (f *fakeBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions { return nil }
func (f *fakeBuilder) AllowedV0Alpha1Resources() []string                 { return nil }
func (f *fakeBuilder) GetGroupVersion() schema.GroupVersion                { return f.gv }

// getterBuilder embeds fakeBuilder and adds Get, so only builders constructed as
// *getterBuilder satisfy APIGroupGetter - a plain *fakeBuilder does not.
type getterBuilder struct {
	fakeBuilder
}

func (g *getterBuilder) Get(_ context.Context, _, _ string) (runtime.Object, error) {
	return g.obj, nil
}

func TestExtractGetters(t *testing.T) {
	getterGV := schema.GroupVersion{Group: "getter.example.com", Version: "v1"}
	nonGetterGV := schema.GroupVersion{Group: "nongetter.example.com", Version: "v1"}

	withGetter := &getterBuilder{fakeBuilder: fakeBuilder{gv: getterGV}}
	withoutGetter := &fakeBuilder{gv: nonGetterGV}

	getters := ExtractGetters([]APIGroupBuilder{withGetter, withoutGetter})

	require.Len(t, getters, 1)
	g, ok := getters[getterGV]
	require.True(t, ok, "expected an entry for the GV whose builder implements APIGroupGetter")
	require.Same(t, withGetter, g)

	_, ok = getters[nonGetterGV]
	require.False(t, ok, "a builder that doesn't implement APIGroupGetter must not get an entry")
}
```

(`APIGroupOptions` is confirmed as the real type name at `common.go:107`.)

- [ ] **Step 2: Run it, confirm it fails**

Run: `go test ./pkg/services/apiserver/builder/... -run TestExtractGetters -v`

Expected: compile error (`ExtractGetters` and `APIGroupGetter` don't exist yet) or a straightforward failure once the fakes compile.

- [ ] **Step 3: Implement**

In `pkg/services/apiserver/builder/common.go`, add next to the existing `APIGroupMutation`/`APIGroupValidation` definitions:

```go
// APIGroupGetter lets a builder opt into supporting OverwriteOnCreateResourceVersion-driven
// create-or-replace for its own resources: when implemented, the admission layer can fetch
// the existing object to run real Update-flavored validation against, instead of only
// Create-flavored validation, when a client signals intent to upsert.
type APIGroupGetter interface {
	Get(ctx context.Context, namespace, name string) (runtime.Object, error)
}
```

(`context` and `runtime` are already imported in this file - check before adding a duplicate import.)

Create `pkg/services/apiserver/builder/getters.go`:

```go
package builder

import "k8s.io/apimachinery/pkg/runtime/schema"

// ExtractGetters collects the APIGroupGetter implementations among builders, keyed by the
// GroupVersions each builder serves. A builder that does not implement APIGroupGetter simply
// has no entry - callers must treat a missing entry as "this GV does not participate", never
// as an error.
func ExtractGetters(builders []APIGroupBuilder) map[schema.GroupVersion]APIGroupGetter {
	getters := make(map[schema.GroupVersion]APIGroupGetter)
	for _, b := range builders {
		g, ok := b.(APIGroupGetter)
		if !ok {
			continue
		}
		for _, gv := range GetGroupVersions(b) {
			getters[gv] = g
		}
	}
	return getters
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `go test ./pkg/services/apiserver/builder/... -run TestExtractGetters -v`

Expected: PASS.

- [ ] **Step 5: Run the full package**

Run: `go test ./pkg/services/apiserver/builder/...`

Expected: `ok`.

- [ ] **Step 6: Commit**

```bash
git add pkg/services/apiserver/builder/common.go pkg/services/apiserver/builder/getters.go pkg/services/apiserver/builder/getters_test.go
git commit -m "builder: add opt-in APIGroupGetter and ExtractGetters helper"
```

---

### Task 4: `DashboardsAPIBuilder` implements `APIGroupGetter`

**Files:**
- Modify: `pkg/registry/apis/dashboard/register.go`
- Test: `pkg/registry/apis/dashboard/register_test.go` (or a new `getter_test.go` in the same package if `register_test.go` has grown unwieldy - check its current size before deciding)

**Interfaces:**
- Consumes: `builder.APIGroupGetter` (Task 3), `DashboardsAPIBuilder.unified resource.ResourceClient` (existing field).
- Produces: `(b *DashboardsAPIBuilder) Get(ctx context.Context, namespace, name string) (runtime.Object, error)` — Task 7's integration test exercises this indirectly through the real apiserver; Task 6's `RegisterAdmission` wiring exercises it directly.

- [ ] **Step 1: Write the failing test**

Read `pkg/registry/apis/dashboard/register_test.go` first to find how `DashboardsAPIBuilder` is already constructed for tests (there should be an existing helper or fixture - reuse it rather than hand-building a builder from scratch with all its many fields). Add a test exercising `Get` against a builder whose `unified` field is a fake/mock `resource.ResourceClient` returning a known `resourcepb.ReadResponse`:

```go
func TestDashboardsAPIBuilderGet(t *testing.T) {
	mockClient := resource.NewMockResourceClient(t)
	mockClient.On("Read", mock.Anything, mock.Anything).Return(&resourcepb.ReadResponse{
		Value: []byte(`{"spec":{"title":"existing"}}`),
	}, nil)

	b := &DashboardsAPIBuilder{unified: mockClient}

	obj, err := b.Get(context.Background(), "ns", "existing-uid")
	require.NoError(t, err)

	u, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok)
	spec, ok := u.Object["spec"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "existing", spec["title"])
}
```

(`resource.NewMockResourceClient(t)` is a real, already-generated mockery mock at `pkg/storage/unified/resource/client_mock.go:1581` — confirmed this session, used the same way `grafanarest.NewMockStorage(t)` was used elsewhere on this branch. Its `Read` method signature is `Read(ctx context.Context, in *resourcepb.ReadRequest, opts ...grpc.CallOption) (*resourcepb.ReadResponse, error)`; since the real `Get` implementation calls it with no variadic opts, `mock.Anything, mock.Anything` (ctx, in) is the right matcher arity. Constructing `&DashboardsAPIBuilder{unified: mockClient}` directly with only the one field set is fine here since `Get` only touches `b.unified` — check `register_test.go` for whether a shared constructor helper already exists and prefer it if so, but a bare struct literal works regardless since `unified` is this method's only dependency.

`register_test.go` already imports `"context"` and `"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"` — add `"github.com/stretchr/testify/mock"`, `"github.com/grafana/grafana/pkg/storage/unified/resource"`, and `"github.com/grafana/grafana/pkg/storage/unified/resourcepb"` to its import block.)

- [ ] **Step 2: Run it, confirm it fails**

Run: `go test ./pkg/registry/apis/dashboard/... -run TestDashboardsAPIBuilderGet -v`

Expected: compile error (`Get` method doesn't exist on `*DashboardsAPIBuilder` yet).

- [ ] **Step 3: Implement**

In `pkg/registry/apis/dashboard/register.go`, add (checking the file's existing imports for `encoding/json`, `unstructured`, and `resourcepb` first - add whichever are missing):

```go
// Get implements builder.APIGroupGetter, letting the admission layer fetch an existing
// dashboard to validate a sentinel-triggered create-or-replace against as a real update.
// Unified storage persists resources as plain JSON (see
// pkg/storage/unified/apistore/serializer.go), so decoding into an unstructured.Unstructured
// avoids needing a specific typed/versioned Go struct or codec here.
func (b *DashboardsAPIBuilder) Get(ctx context.Context, namespace, name string) (runtime.Object, error) {
	rsp, err := b.unified.Read(ctx, &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Group:     dashv0.GROUP,
			Resource:  dashv0.DASHBOARD_RESOURCE,
			Namespace: namespace,
			Name:      name,
		},
	})
	if err := resource.ErrorFromResponse(rsp.GetError(), err); err != nil {
		return nil, resource.GetError(resource.AsErrorResult(err))
	}
	obj := &unstructured.Unstructured{}
	if err := json.Unmarshal(rsp.Value, &obj.Object); err != nil {
		return nil, err
	}
	return obj, nil
}
```

Check the top of `register.go` for the exact existing import aliases for `dashv0` (the `dashboard.grafana.app` v0alpha1 package, already used elsewhere in this file per earlier session investigation - e.g. `dashv0.DASHBOARD_RESOURCE` was referenced in `Validate`) and `resource`/`resourcepb` (the unified-storage client/proto packages `DashboardsAPIBuilder.unified` already uses) - reuse those exact aliases, don't introduce new ones for the same packages.

- [ ] **Step 4: Run it, confirm it passes**

Run: `go test ./pkg/registry/apis/dashboard/... -run TestDashboardsAPIBuilderGet -v`

Expected: PASS.

- [ ] **Step 5: Run the full package (slow compile, ~2 min per AGENTS.md)**

Run: `go test ./pkg/registry/apis/dashboard/...`

Expected: `ok`.

- [ ] **Step 6: Commit**

```bash
git add pkg/registry/apis/dashboard/register.go pkg/registry/apis/dashboard/register_test.go
git commit -m "dashboard: implement APIGroupGetter via the existing unified resource client"
```

---

### Task 5: The marker annotation + the admission rewrite wrapper

**Files:**
- Modify: `pkg/apimachinery/utils/meta.go`
- Create: `pkg/services/apiserver/appinstaller/overwrite_admission.go`
- Test: `pkg/services/apiserver/appinstaller/overwrite_admission_test.go`

**Interfaces:**
- Consumes: `builder.APIGroupGetter`, `builder.ExtractGetters` (Task 3), `apistore.OverwriteOnCreateResourceVersion` (existing).
- Produces: `utils.AnnoKeyOverwriteValidated` (new `string` constant); `newOverwriteAdmission(chain admission.Interface, getters map[schema.GroupVersion]builder.APIGroupGetter) admission.Interface` — Task 7's `RegisterAdmission` change wraps its assembled chain with this.

- [ ] **Step 1: Add the marker constant**

In `pkg/apimachinery/utils/meta.go`, right after the existing `AnnoGrantPermissionsDefault` block:

```go

// AnnoKeyOverwriteValidated marks an object, only transiently, as having already passed
// real Update-flavored admission validation for a sentinel-triggered create-or-replace.
// Only the admission layer may set it (never trust a client-supplied value) - it is stripped
// before persisting either way, and apistore's createOrReplace requires it present before
// treating a Create as an upsert.
const AnnoKeyOverwriteValidated = "grafana.app/overwrite-validated"
```

- [ ] **Step 2: Write the failing tests for the wrapper**

Create `pkg/services/apiserver/appinstaller/overwrite_admission_test.go`:

```go
package appinstaller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var testGV = schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1", Resource: "things"}
var testKind = schema.GroupVersionKind{Group: "example.grafana.app", Version: "v1", Kind: "Thing"}

type fakeGetter struct {
	obj runtime.Object
	err error
}

func (f fakeGetter) Get(_ context.Context, _, _ string) (runtime.Object, error) {
	return f.obj, f.err
}

// recordingChain records every Attributes it's called with, so tests can assert exactly
// what the wrapper dispatched downstream - the operation, and whether OldObject was set.
type recordingChain struct {
	admitCalls, validateCalls []admission.Attributes
	err                       error
}

func (r *recordingChain) Admit(_ context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	r.admitCalls = append(r.admitCalls, a)
	return r.err
}

func (r *recordingChain) Validate(_ context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	r.validateCalls = append(r.validateCalls, a)
	return r.err
}

func (r *recordingChain) Handles(admission.Operation) bool { return true }

func newUnstructuredWithRV(rv string) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{Object: map[string]interface{}{}}
	obj.SetName("existing-name")
	obj.SetNamespace("ns")
	if rv != "" {
		obj.SetResourceVersion(rv)
	}
	return obj
}

func newAttrs(obj runtime.Object, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(obj, nil, testKind, "ns", "existing-name", testGV, "", op, &metav1.CreateOptions{}, false, &user.DefaultInfo{Name: "tester"})
}

func TestOverwriteAdmission_NonSentinelPassesThroughUnchanged(t *testing.T) {
	chain := &recordingChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{
		testGV.GroupVersion(): fakeGetter{obj: newUnstructuredWithRV("")},
	})

	obj := newUnstructuredWithRV("")
	a := newAttrs(obj, admission.Create)
	require.NoError(t, wrapper.Validate(context.Background(), a, nil))

	require.Len(t, chain.validateCalls, 1)
	require.Same(t, a, chain.validateCalls[0], "a non-sentinel request must reach the chain completely unchanged")
}

func TestOverwriteAdmission_NoGetterRegisteredPassesThroughUnchanged(t *testing.T) {
	chain := &recordingChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{})

	obj := newUnstructuredWithRV(apistore.OverwriteOnCreateResourceVersion)
	a := newAttrs(obj, admission.Create)
	require.NoError(t, wrapper.Validate(context.Background(), a, nil))

	require.Len(t, chain.validateCalls, 1)
	require.Equal(t, admission.Create, chain.validateCalls[0].GetOperation(), "a GV with no registered Getter must dispatch unchanged, still as Create")
}

func TestOverwriteAdmission_SentinelWithGetterRewritesToUpdate(t *testing.T) {
	existing := newUnstructuredWithRV("")
	chain := &recordingChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{
		testGV.GroupVersion(): fakeGetter{obj: existing},
	})

	obj := newUnstructuredWithRV(apistore.OverwriteOnCreateResourceVersion)
	a := newAttrs(obj, admission.Create)
	require.NoError(t, wrapper.Validate(context.Background(), a, nil))

	require.Len(t, chain.validateCalls, 1)
	dispatched := chain.validateCalls[0]
	require.Equal(t, admission.Update, dispatched.GetOperation(), "must be re-dispatched as a real Update")
	require.Same(t, existing, dispatched.GetOldObject(), "must carry the real existing object as OldObject")

	dispatchedObj, ok := dispatched.GetObject().(*unstructured.Unstructured)
	require.True(t, ok)
	meta, err := utils.MetaAccessor(dispatchedObj)
	require.NoError(t, err)
	require.Equal(t, "true", meta.GetAnnotation(utils.AnnoKeyOverwriteValidated), "a successful synthetic re-dispatch must stamp the marker")
}

func TestOverwriteAdmission_ClientSuppliedMarkerIsAlwaysStripped(t *testing.T) {
	chain := &recordingChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{})

	obj := newUnstructuredWithRV("") // non-sentinel: this GV path doesn't even need a Getter
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetAnnotation(utils.AnnoKeyOverwriteValidated, "true") // a client trying to forge the marker

	a := newAttrs(obj, admission.Create)
	require.NoError(t, wrapper.Admit(context.Background(), a, nil))

	require.Len(t, chain.admitCalls, 1)
	dispatchedObj, ok := chain.admitCalls[0].GetObject().(*unstructured.Unstructured)
	require.True(t, ok)
	dispatchedMeta, err := utils.MetaAccessor(dispatchedObj)
	require.NoError(t, err)
	require.Equal(t, "", dispatchedMeta.GetAnnotation(utils.AnnoKeyOverwriteValidated), "a client-supplied marker must never reach the chain, under any circumstance")
}

func TestOverwriteAdmission_GetterErrorPropagatesUnchanged(t *testing.T) {
	boom := fakeGetter{err: errTestGetterFailure}
	chain := &recordingChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{
		testGV.GroupVersion(): boom,
	})

	obj := newUnstructuredWithRV(apistore.OverwriteOnCreateResourceVersion)
	a := newAttrs(obj, admission.Create)
	err := wrapper.Validate(context.Background(), a, nil)
	require.ErrorIs(t, err, errTestGetterFailure)
	require.Empty(t, chain.validateCalls, "the chain must never be reached if the Getter itself errors")
}
```

Add a package-level sentinel error for the last test, next to the other test-only types:

```go
var errTestGetterFailure = errors.New("boom: fake getter failure")
```

(add `"errors"` to the import block if not already present in this new file.)

- [ ] **Step 3: Run it, confirm it fails**

Run: `go test ./pkg/services/apiserver/appinstaller/... -run TestOverwriteAdmission -v`

Expected: compile error (`newOverwriteAdmission` doesn't exist yet).

- [ ] **Step 4: Implement the wrapper**

Create `pkg/services/apiserver/appinstaller/overwrite_admission.go`:

```go
package appinstaller

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// overwriteAdmission wraps an already-assembled admission chain so that a Create request
// carrying apistore.OverwriteOnCreateResourceVersion runs real Update-flavored validation
// (with a real OldObject) against the target's GV, when that GV has opted in via a
// registered builder.APIGroupGetter - instead of only ever running Create-flavored
// validation, which is what every downstream REST/storage layer alone can observe.
type overwriteAdmission struct {
	chain   admission.Interface
	getters map[schema.GroupVersion]builder.APIGroupGetter
}

func newOverwriteAdmission(chain admission.Interface, getters map[schema.GroupVersion]builder.APIGroupGetter) admission.Interface {
	return &overwriteAdmission{chain: chain, getters: getters}
}

var (
	_ admission.MutationInterface   = (*overwriteAdmission)(nil)
	_ admission.ValidationInterface = (*overwriteAdmission)(nil)
)

func (o *overwriteAdmission) Handles(operation admission.Operation) bool {
	return o.chain.Handles(operation)
}

func (o *overwriteAdmission) Admit(ctx context.Context, a admission.Attributes, i admission.ObjectInterfaces) error {
	mutator, ok := o.chain.(admission.MutationInterface)
	if !ok {
		return nil
	}
	rewritten, err := o.rewrite(ctx, a)
	if err != nil {
		return err
	}
	return mutator.Admit(ctx, rewritten, i)
}

func (o *overwriteAdmission) Validate(ctx context.Context, a admission.Attributes, i admission.ObjectInterfaces) error {
	validator, ok := o.chain.(admission.ValidationInterface)
	if !ok {
		return nil
	}
	rewritten, err := o.rewrite(ctx, a)
	if err != nil {
		return err
	}
	return validator.Validate(ctx, rewritten, i)
}

// rewrite always strips any client-supplied marker first - never trust it - then, only for
// a genuine sentinel-triggered Create against a GV with a registered Getter, fetches the
// existing object and returns synthetic Update-flavored Attributes with the marker freshly
// stamped. Every other case returns a (possibly marker-stripped) but otherwise unchanged a.
func (o *overwriteAdmission) rewrite(ctx context.Context, a admission.Attributes) (admission.Attributes, error) {
	obj := a.GetObject()
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return a, nil
	}
	meta.SetAnnotation(utils.AnnoKeyOverwriteValidated, "")

	if a.GetOperation() != admission.Create || meta.GetResourceVersion() != apistore.OverwriteOnCreateResourceVersion {
		return a, nil
	}
	getter, ok := o.getters[a.GetResource().GroupVersion()]
	if !ok {
		return a, nil
	}

	existing, err := getter.Get(ctx, a.GetNamespace(), a.GetName())
	if err != nil {
		return nil, err
	}

	meta.SetAnnotation(utils.AnnoKeyOverwriteValidated, "true")
	return admission.NewAttributesRecord(
		obj, existing, a.GetKind(), a.GetNamespace(), a.GetName(), a.GetResource(), a.GetSubresource(),
		admission.Update, a.GetOperationOptions(), a.IsDryRun(), a.GetUserInfo(),
	), nil
}
```

Note what this deliberately does *not* do: it never calls `o.chain.Admit`/`.Validate` with the plain un-rewritten `obj` after a successful Getter lookup - the synthetic attributes carry the *mutated* `obj` (marker now stamped, sentinel RV untouched since `meta.SetResourceVersion` is never called here - clearing the sentinel itself stays apistore's job, done in `Storage.Create`, so this wrapper's only responsibility is the marker and the operation/old-object rewrite).

- [ ] **Step 5: Run it, confirm all five new tests pass**

Run: `go test ./pkg/services/apiserver/appinstaller/... -run TestOverwriteAdmission -v`

Expected: PASS for all five.

- [ ] **Step 6: Commit**

```bash
git add pkg/apimachinery/utils/meta.go pkg/services/apiserver/appinstaller/overwrite_admission.go pkg/services/apiserver/appinstaller/overwrite_admission_test.go
git commit -m "appinstaller: add the sentinel-detection admission rewrite wrapper"
```

---

### Task 6: Gate `createOrReplace` on the marker

**Files:**
- Modify: `pkg/storage/unified/apistore/store.go`
- Modify: `pkg/storage/unified/apistore/store_test.go`

**Interfaces:**
- Consumes: `utils.AnnoKeyOverwriteValidated` (Task 5).

This is the step that changes existing, already-passing behavior on this branch - every `createOrReplace` test written before this task assumed the sentinel alone was enough. After this task, it isn't: the marker must also be present, because without the admission wrapper from Task 5 actually running (which nothing in `store_test.go` exercises - these are storage-layer-only tests), there's no real proof the right validation happened.

- [ ] **Step 1: Write the new failing test for the gated-closed default**

Add to `store_test.go`:

```go
func TestCreateOrReplaceRequiresMarkerEvenWithSentinel(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	require.NoError(t, err)

	key := "pods/test-ns/no-marker"
	first := &example.Pod{ObjectMeta: metav1.ObjectMeta{Name: "no-marker", Namespace: "test-ns"}}
	firstOut := &example.Pod{}
	require.NoError(t, store.Create(ctx, key, first, firstOut, 0))

	// Sentinel set, but no AnnoKeyOverwriteValidated - simulating a client that sent the
	// sentinel directly without going through admission (or a GV admission never validated).
	second := &example.Pod{ObjectMeta: metav1.ObjectMeta{
		Name: "no-marker", Namespace: "test-ns", ResourceVersion: apistore.OverwriteOnCreateResourceVersion,
	}}
	secondOut := &example.Pod{}
	err = store.Create(ctx, key, second, secondOut, 0)
	require.True(t, apierrors.IsAlreadyExists(err), "without the marker, a sentinel create against an existing object must still 409, exactly like a plain create would")
}
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `go test ./pkg/storage/unified/apistore/... -run TestCreateOrReplaceRequiresMarkerEvenWithSentinel -v`

Expected: FAIL (`NoError` instead of the expected `AlreadyExists`) — today's code upserts unconditionally once it sees the sentinel, regardless of any marker.

- [ ] **Step 3: Implement the gate**

In `Storage.Create` (`store.go`), the existing sentinel branch:

```go
	if meta.GetResourceVersion() == OverwriteOnCreateResourceVersion {
		meta.SetResourceVersion("")
		return s.createOrReplace(ctx, key, obj, out, ttl)
	}
```

becomes:

```go
	if meta.GetResourceVersion() == OverwriteOnCreateResourceVersion {
		meta.SetResourceVersion("")
		validated := meta.GetAnnotation(utils.AnnoKeyOverwriteValidated) == "true"
		meta.SetAnnotation(utils.AnnoKeyOverwriteValidated, "")
		if validated {
			return s.createOrReplace(ctx, key, obj, out, ttl)
		}
		// Sentinel present but never validated by admission (no Getter registered for this
		// GV, or the marker was stripped/never set) - fall through to a plain create, which
		// 409s on an existing name exactly like it always has.
	}
```

(`utils` is already imported in `store.go` - confirm, don't re-add.)

- [ ] **Step 4: Run it, confirm it passes**

Run: `go test ./pkg/storage/unified/apistore/... -run TestCreateOrReplaceRequiresMarkerEvenWithSentinel -v`

Expected: PASS.

- [ ] **Step 5: Fix every other `createOrReplace` test to stamp the marker**

Every existing test that expects the upsert path to fire (`TestCreateOrReplaceCreatesWhenMissing`, `TestCreateOrReplaceReplacesWhenFound`, `TestCreateOrReplaceRejectsRepoManagedResource`, `TestCreateOrReplaceDeepCopiesObjectPerRetryAttempt` from Task 1, `TestCreateOrReplaceRejectsUpdateWithoutUpdateRights` from Task 2) must now set `utils.AnnoKeyOverwriteValidated: "true"` on the object it passes to the sentinel-triggered `Create` call, simulating what the admission wrapper would have done. For each one, add this right after constructing the object with the sentinel resourceVersion (pattern to repeat for every such object in every listed test):

```go
	meta, err := utils.MetaAccessor(second) // or whatever the object variable is named in that test
	require.NoError(t, err)
	meta.SetAnnotation(utils.AnnoKeyOverwriteValidated, "true")
```

`TestCreateNonSentinelResourceVersionsUnchanged` and `TestCreateOrReplaceGetErrorPropagatesUnchanged` are unaffected (neither exercises a case where the marker would matter - the first never sets the sentinel at all, the second fails before the marker check is ever reached) and need no change.

- [ ] **Step 6: Run the full `createOrReplace` test set**

Run: `go test ./pkg/storage/unified/apistore/... -run 'TestCreateOrReplace|TestCreateNonSentinelResourceVersionsUnchanged' -v`

Expected: PASS for every test in this set, including the new one from Step 1.

- [ ] **Step 7: Run the full package**

Run: `go test ./pkg/storage/unified/apistore/...`

Expected: `ok`.

- [ ] **Step 8: Commit**

```bash
git add pkg/storage/unified/apistore/store.go pkg/storage/unified/apistore/store_test.go
git commit -m "apistore: require the overwrite-validated marker before replacing"
```

---

### Task 7: Wire the wrapper into `RegisterAdmission`

**Files:**
- Modify: `pkg/services/apiserver/appinstaller/installer.go`
- Modify: `pkg/services/apiserver/service.go`
- Test: `pkg/services/apiserver/appinstaller/installer_test.go` (check whether `RegisterAdmission` already has a test there before deciding whether to extend one or add a new test function)

**Interfaces:**
- Consumes: `builder.ExtractGetters` (Task 3), `newOverwriteAdmission` (Task 5).

- [ ] **Step 1: Write the failing test**

Read `pkg/services/apiserver/appinstaller/installer_test.go` first for any existing `RegisterAdmission` test and its construction pattern for fake `appsdkapiserver.AppInstaller`s (needed to call `RegisterAdmission` at all, since its second parameter is `[]appsdkapiserver.AppInstaller`). Add (or extend) a test proving the three-argument signature wraps the result:

```go
// registerAdmissionFakeBuilder is local to this test file (not Task 3's builder.fakeBuilder -
// appinstaller and builder are different packages, and this double is small enough not to be
// worth exporting cross-package just to share it). Satisfies builder.APIGroupBuilder's real
// methods (common.go:30-50), builder.APIGroupVersionProvider (GetGroupVersion), and
// builder.APIGroupGetter (Get).
type registerAdmissionFakeBuilder struct {
	gv  schema.GroupVersion
	obj runtime.Object
}

func (f *registerAdmissionFakeBuilder) InstallSchema(*runtime.Scheme) error { return nil }
func (f *registerAdmissionFakeBuilder) UpdateAPIGroupInfo(*genericapiserver.APIGroupInfo, builder.APIGroupOptions) error {
	return nil
}
func (f *registerAdmissionFakeBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions { return nil }
func (f *registerAdmissionFakeBuilder) AllowedV0Alpha1Resources() []string                  { return nil }
func (f *registerAdmissionFakeBuilder) GetGroupVersion() schema.GroupVersion                { return f.gv }
func (f *registerAdmissionFakeBuilder) Get(_ context.Context, _, _ string) (runtime.Object, error) {
	return f.obj, nil
}

func TestRegisterAdmissionWrapsResultWithOverwriteAdmission(t *testing.T) {
	existing := &recordingChain{} // from overwrite_admission_test.go, same package
	fb := &registerAdmissionFakeBuilder{gv: testGV.GroupVersion(), obj: newUnstructuredWithRV("")}

	result, err := RegisterAdmission(existing, nil, []builder.APIGroupBuilder{fb})
	require.NoError(t, err)

	// A sentinel-triggered request against the fake builder's GV must come out the other
	// end as a real Update, proving RegisterAdmission's result is actually wrapped and not
	// just the plain chain it was before this task.
	obj := newUnstructuredWithRV(apistore.OverwriteOnCreateResourceVersion)
	a := newAttrs(obj, admission.Create)
	validator, ok := result.(admission.ValidationInterface)
	require.True(t, ok)
	require.NoError(t, validator.Validate(context.Background(), a, nil))
}
```

(Needs `genericapiserver "k8s.io/apiserver/pkg/server"` and `"k8s.io/kube-openapi/pkg/common"` added to this test file's imports — both already used this exact way in Task 3's `getters_test.go`, for consistency.)

- [ ] **Step 2: Run it, confirm it fails**

Run: `go test ./pkg/services/apiserver/appinstaller/... -run TestRegisterAdmissionWrapsResultWithOverwriteAdmission -v`

Expected: compile error - `RegisterAdmission` doesn't take a third parameter yet.

- [ ] **Step 3: Implement**

In `pkg/services/apiserver/appinstaller/installer.go`, change `RegisterAdmission`'s signature and body:

```go
// RegisterAdmission combines the existing admission control from builders with every
// AppInstaller's own admission plugin, then wraps the result so a sentinel-triggered Create
// (see apistore.OverwriteOnCreateResourceVersion) runs real Update-flavored validation for
// any GV whose builder has opted in via builder.APIGroupGetter.
func RegisterAdmission(
	existingAdmission admission.Interface,
	appInstallers []appsdkapiserver.AppInstaller,
	builders []builder.APIGroupBuilder,
) (admission.Interface, error) {
	controllers := []admission.Interface{}

	for _, installer := range appInstallers {
		factory := installer.AdmissionPlugin()
		if factory == nil {
			continue
		}

		admissionInterface, err := factory(nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create admission plugin: %w", err)
		}
		controllers = append(controllers, admissionInterface)
	}

	if existingAdmission != nil {
		controllers = append(controllers, existingAdmission)
	}

	chain := admission.NewChainHandler(controllers...)
	return newOverwriteAdmission(chain, builder.ExtractGetters(builders)), nil
}
```

(`builder` is already imported in this file.)

In `pkg/services/apiserver/service.go`, update the call site (currently at line ~485):

```go
	serverConfig.AdmissionControl, err = appinstaller.RegisterAdmission(
		serverConfig.AdmissionControl,
		s.appInstallers,
		builders,
	)
```

Confirm `builders` is the right in-scope variable name at that point in `service.go` by reading the surrounding ~50 lines (it's used just above, passed into `builder.SetupConfig`, at line 470) - use whatever it's actually called there, don't assume the name without checking.

- [ ] **Step 4: Run it, confirm it passes**

Run: `go test ./pkg/services/apiserver/appinstaller/... -run TestRegisterAdmissionWrapsResultWithOverwriteAdmission -v`

Expected: PASS.

- [ ] **Step 5: Build the whole repo to catch any other `RegisterAdmission` call site**

Run: `go build ./...`

Expected: no errors. If any other call site exists beyond `service.go` (search first: `grep -rn "RegisterAdmission(" --include=*.go .`), update it too before this step can pass.

- [ ] **Step 6: Run the full appinstaller and service packages**

Run: `go test ./pkg/services/apiserver/appinstaller/... ./pkg/services/apiserver/...`

Expected: `ok` (the second package's tests may be slow - this is normal for `pkg/services/apiserver`, allow a few minutes).

- [ ] **Step 7: Commit**

```bash
git add pkg/services/apiserver/appinstaller/installer.go pkg/services/apiserver/service.go pkg/services/apiserver/appinstaller/installer_test.go
git commit -m "appinstaller: wrap RegisterAdmission's chain with the overwrite rewrite"
```

---

### Task 8: End-to-end integration test against the real apiserver

**Files:**
- Create: `pkg/tests/apis/dashboard/overwrite_admission_test.go`

**Interfaces:**
- Consumes: everything from Tasks 1-7, exercised only through the real HTTP/apiserver surface - no direct calls to any internal type.

- [ ] **Step 1: Write the integration test**

Create `pkg/tests/apis/dashboard/overwrite_admission_test.go`. This needs a dashboard whose `validateUpdate` folder-change check can actually be observed firing - which means creating the dashboard in one folder, then sentinel-replacing it into a *different* folder the caller does not have access to, and asserting that specific rejection (not just "some error"):

```go
package dashboards

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDashboardOverwriteAdmission(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	gvr := schema.GroupVersionResource{
		Group:    dashboardV2beta1.GROUP,
		Version:  dashboardV2beta1.VERSION,
		Resource: "dashboards",
	}

	newDashboard := func(name, title string) *unstructured.Unstructured {
		obj := &unstructured.Unstructured{Object: map[string]interface{}{
			"spec": map[string]any{"title": title},
		}}
		obj.SetName(name)
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Dashboard")
		return obj
	}

	t.Run("sentinel-triggered replace runs real update validation, not just create", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{DisableAnonymous: true})
		t.Cleanup(helper.Shutdown)

		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		first := newDashboard("admission-overwrite-uid", "first title")
		_, err := client.Resource.Create(ctx, first, metav1.CreateOptions{})
		require.NoError(t, err)

		second := newDashboard("admission-overwrite-uid", "second title")
		second.SetResourceVersion(apistore.OverwriteOnCreateResourceVersion)

		updated, err := client.Resource.Create(ctx, second, metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "second title", updated.Object["spec"].(map[string]any)["title"])
	})

	t.Run("non-sentinel second create still 409s", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{DisableAnonymous: true})
		t.Cleanup(helper.Shutdown)

		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		first := newDashboard("no-admission-overwrite-uid", "first title")
		_, err := client.Resource.Create(ctx, first, metav1.CreateOptions{})
		require.NoError(t, err)

		second := newDashboard("no-admission-overwrite-uid", "second title")
		_, err = client.Resource.Create(ctx, second, metav1.CreateOptions{})
		require.True(t, errors.IsAlreadyExists(err), "expected AlreadyExists, got: %v", err)
	})

	t.Run("caller with create-but-not-update rights is rejected", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{DisableAnonymous: true})
		t.Cleanup(helper.Shutdown)

		ctx := context.Background()
		adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})
		viewerClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Viewer,
			GVR:  gvr,
		})

		first := newDashboard("viewer-overwrite-uid", "first title")
		_, err := adminClient.Resource.Create(ctx, first, metav1.CreateOptions{})
		require.NoError(t, err)

		second := newDashboard("viewer-overwrite-uid", "second title")
		second.SetResourceVersion(apistore.OverwriteOnCreateResourceVersion)

		_, err = viewerClient.Resource.Create(ctx, second, metav1.CreateOptions{})
		require.True(t, errors.IsForbidden(err), "expected Forbidden, got: %v", err)
	})
}
```

Note: this plan deliberately does not attempt a fourth sub-test proving the folder-change validation specifically fires (e.g. replacing into a folder the caller lacks access to) - setting up two folders with the right permission boundary via this test harness is its own small investigation (check `pkg/tests/apis/dashboard/dashboards_test.go` and `pkg/tests/apis/folder/folders_test.go` for the existing pattern for creating a folder and a restricted user in this harness before attempting it) and is valuable but not required to prove this plan's core claim - the three sub-tests above already prove the mechanism works end-to-end through the real apiserver. If time allows once these three pass, add it as a fourth sub-test following the same pattern; if not, it's a reasonable follow-up, not a gap in this plan's own completion contract.

- [ ] **Step 2: Run it**

Run: `go test ./pkg/tests/apis/dashboard/... -run TestIntegrationDashboardOverwriteAdmission -v`

Expected: PASS for all three sub-tests. If the first fails with `AlreadyExists`, re-check Task 7's wiring reached this code path at all (e.g. log or breakpoint in `overwriteAdmission.rewrite` to confirm it's even being called for this request). If the third fails to reject, re-check that `pkg/registry/apis/dashboard/register.go`'s `validateUpdate` really does perform a permission check reachable by this scenario - re-read it before assuming the wiring is wrong.

- [ ] **Step 3: Commit**

```bash
git add pkg/tests/apis/dashboard/overwrite_admission_test.go
git commit -m "dashboard: add integration test for the admission-layer overwrite rewrite"
```

---

## Notes for the implementer

- Track 2 (app-sdk-native apps) is a separate follow-up plan, blocked on a `grafana-app-sdk` change being prototyped and landed first. Nothing in this plan should anticipate or stub that out.
- Folders, quota admission, the `ManagerKindTerraform`/`ManagerKindKubectl` gap, and the Terraform provider change are all out of scope per the spec - don't fold fixes for any of them in "while you're in there."
