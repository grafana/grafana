package prometheusrulefile

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"testing"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/apis/rulesextensions/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/app/config"
	alertingv0 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// These tests exercise the reconciler against in-memory fake clients. They cover the four
// behaviours the reconciler is responsible for:
//
//   - apply: a new PrometheusRuleFile produces the expected folder hierarchy and rules,
//     and stamps the inventory + a success operatorState on status.
//   - idempotency: running the reconcile twice with the same spec on the same store
//     does not produce duplicate Create calls and (after #5) does not even issue an Update.
//   - prune: when a group is removed from the spec, the children that used to belong to it
//     are deleted on the next reconcile and disappear from status.
//   - cleanup (Deleted action): every child currently in status is deleted; whatever isn't
//     in status is left alone.

func TestReconciler_AppliesChildrenAndStampsStatus(t *testing.T) {
	r, st := newTestReconciler(t)
	file := newFile("file-a", "ds-1", []model.PrometheusRuleFilePrometheusRuleGroup{
		makeGroup("groupA", "AlertHigh", "up == 0"),
	})
	require.NoError(t, st.files.create(file))

	res, err := r.Reconcile(context.Background(), operator.ReconcileRequest{
		Action: operator.ReconcileActionCreated,
		Object: file,
	})
	require.NoError(t, err)
	assert.Nil(t, res.RequeueAfter)

	// File folder + group folder created.
	assert.Len(t, st.folders.items, 2, "one file folder + one group folder")
	// Single alert rule created.
	assert.Len(t, st.alertRules.items, 1)
	assert.Empty(t, st.recordingRules.items)

	// Status now reflects what was created and a success operatorState.
	got := st.files.items[file.GetName()].(*model.PrometheusRuleFile)
	assert.NotEmpty(t, got.Status.ManagedFileFolder)
	assert.Len(t, got.Status.ManagedFolders, 1)
	assert.Len(t, got.Status.ManagedAlertRules, 1)
	assert.Empty(t, got.Status.ManagedRecordingRules)
	requireSuccessOperatorState(t, got)
}

func TestReconciler_ResyncIsIdempotent(t *testing.T) {
	r, st := newTestReconciler(t)
	file := newFile("file-a", "ds-1", []model.PrometheusRuleFilePrometheusRuleGroup{
		makeGroup("groupA", "AlertHigh", "up == 0"),
	})
	require.NoError(t, st.files.create(file))

	// First reconcile creates everything.
	_, err := r.Reconcile(context.Background(), operator.ReconcileRequest{Action: operator.ReconcileActionCreated, Object: file})
	require.NoError(t, err)
	createsBefore := st.folders.creates + st.alertRules.creates + st.recordingRules.creates
	updatesBefore := st.folders.updates + st.alertRules.updates + st.recordingRules.updates

	// Hand the reconciler the post-reconcile object so it sees the populated status.
	current := st.files.items[file.GetName()].(*model.PrometheusRuleFile)

	// Second reconcile (resync) should be a no-op: every child already matches.
	_, err = r.Reconcile(context.Background(), operator.ReconcileRequest{Action: operator.ReconcileActionResynced, Object: current})
	require.NoError(t, err)

	assert.Equal(t, createsBefore, st.folders.creates+st.alertRules.creates+st.recordingRules.creates, "second reconcile must not Create any children")
	assert.Equal(t, updatesBefore, st.folders.updates+st.alertRules.updates+st.recordingRules.updates, "second reconcile must not Update any children (no-op skip)")
}

func TestReconciler_PrunesRemovedChildren(t *testing.T) {
	r, st := newTestReconciler(t)
	file := newFile("file-a", "ds-1", []model.PrometheusRuleFilePrometheusRuleGroup{
		makeGroup("groupA", "AlertHigh", "up == 0"),
		makeGroup("groupB", "AlertLow", "up == 1"),
	})
	require.NoError(t, st.files.create(file))

	// First reconcile: two groups, two alert rules, two group folders.
	_, err := r.Reconcile(context.Background(), operator.ReconcileRequest{Action: operator.ReconcileActionCreated, Object: file})
	require.NoError(t, err)
	require.Len(t, st.folders.items, 3, "file folder + 2 group folders")
	require.Len(t, st.alertRules.items, 2)

	// Remove groupB from the spec.
	current := st.files.items[file.GetName()].(*model.PrometheusRuleFile)
	current.Spec.Groups = current.Spec.Groups[:1]

	_, err = r.Reconcile(context.Background(), operator.ReconcileRequest{Action: operator.ReconcileActionUpdated, Object: current})
	require.NoError(t, err)

	assert.Len(t, st.folders.items, 2, "groupB's folder must be pruned (file folder + groupA folder remain)")
	assert.Len(t, st.alertRules.items, 1, "groupB's alert rule must be pruned")

	got := st.files.items[file.GetName()].(*model.PrometheusRuleFile)
	assert.Len(t, got.Status.ManagedFolders, 1)
	assert.Len(t, got.Status.ManagedAlertRules, 1)
}

func TestReconciler_CleanupDeletesEveryChildInStatus(t *testing.T) {
	r, st := newTestReconciler(t)
	file := newFile("file-a", "ds-1", []model.PrometheusRuleFilePrometheusRuleGroup{
		makeGroup("groupA", "AlertHigh", "up == 0"),
	})
	require.NoError(t, st.files.create(file))
	_, err := r.Reconcile(context.Background(), operator.ReconcileRequest{Action: operator.ReconcileActionCreated, Object: file})
	require.NoError(t, err)
	require.NotEmpty(t, st.folders.items)
	require.NotEmpty(t, st.alertRules.items)

	current := st.files.items[file.GetName()].(*model.PrometheusRuleFile)
	_, err = r.Reconcile(context.Background(), operator.ReconcileRequest{Action: operator.ReconcileActionDeleted, Object: current})
	require.NoError(t, err)

	assert.Empty(t, st.folders.items, "every managed folder must be deleted on cleanup")
	assert.Empty(t, st.alertRules.items, "every managed alert rule must be deleted on cleanup")
}

func TestReconciler_FailureWritesFailedOperatorState(t *testing.T) {
	r, st := newTestReconciler(t)
	// Inject a failure on AlertRule create — the converter will produce an alert rule that
	// the fake client refuses to accept. The reconciler must surface this on status.
	st.alertRules.createHook = func(obj resource.Object) error {
		return errors.New("boom")
	}

	file := newFile("file-a", "ds-1", []model.PrometheusRuleFilePrometheusRuleGroup{
		makeGroup("groupA", "AlertHigh", "up == 0"),
	})
	require.NoError(t, st.files.create(file))

	_, err := r.Reconcile(context.Background(), operator.ReconcileRequest{Action: operator.ReconcileActionCreated, Object: file})
	require.Error(t, err, "reconcile must return the underlying error")

	got := st.files.items[file.GetName()].(*model.PrometheusRuleFile)
	op, ok := got.Status.OperatorStates[operatorStateID]
	require.True(t, ok, "OperatorStates entry must be written even when applyChildren fails")
	assert.Equal(t, model.PrometheusRuleFileStatusOperatorStateStateFailed, op.State)
	require.NotNil(t, op.DescriptiveState)
	assert.Contains(t, *op.DescriptiveState, "boom")
}

// --- test helpers ---

func requireSuccessOperatorState(t *testing.T, file *model.PrometheusRuleFile) {
	t.Helper()
	op, ok := file.Status.OperatorStates[operatorStateID]
	require.True(t, ok, "expected an operator state entry under %q", operatorStateID)
	assert.Equal(t, model.PrometheusRuleFileStatusOperatorStateStateSuccess, op.State)
}

func newFile(name, datasourceUID string, groups []model.PrometheusRuleFilePrometheusRuleGroup) *model.PrometheusRuleFile {
	f := model.NewPrometheusRuleFile()
	f.Name = name
	f.Namespace = "ns"
	f.UID = types.UID("uid-" + name)
	f.Annotations = map[string]string{model.FolderAnnotationKey: "parent-folder"}
	ds := model.PrometheusRuleFileDatasourceUID(datasourceUID)
	f.Spec.DatasourceUID = &ds
	f.Spec.Groups = groups
	return f
}

func makeGroup(name, alertName, expr string) model.PrometheusRuleFilePrometheusRuleGroup {
	an := alertName
	return model.PrometheusRuleFilePrometheusRuleGroup{
		Name: name,
		Rules: []model.PrometheusRuleFileRuleEntry{
			{Alert: &an, Expr: expr},
		},
	}
}

type stores struct {
	files          *fakeClient
	folders        *fakeClient
	alertRules     *fakeClient
	recordingRules *fakeClient
}

func newTestReconciler(t *testing.T) (*Reconciler, *stores) {
	t.Helper()
	st := &stores{
		files:          newFakeClient(model.PrometheusRuleFileKind().GroupVersionKind(), func() resource.Object { return model.NewPrometheusRuleFile() }),
		folders:        newFakeClient(folderv1.FolderKind().GroupVersionKind(), func() resource.Object { return &folderv1.Folder{} }),
		alertRules:     newFakeClient(alertingv0.AlertRuleKind().GroupVersionKind(), func() resource.Object { return &alertingv0.AlertRule{} }),
		recordingRules: newFakeClient(alertingv0.RecordingRuleKind().GroupVersionKind(), func() resource.Object { return &alertingv0.RecordingRule{} }),
	}
	r, err := NewReconciler(config.RuntimeConfig{DefaultDatasourceUID: "ds-default"}, st.files, st.folders, st.alertRules, st.recordingRules)
	require.NoError(t, err)
	return r, st
}

// fakeClient is a minimal, in-memory resource.Client used by the reconciler tests. It
// implements only the methods the reconciler exercises (Get / GetInto / Create / Update /
// UpdateInto / Delete / List) and panics on the rest so unintended call sites surface
// immediately. Concurrency is irrelevant — tests are single-threaded — but a mutex keeps
// things safe under future race-tagged runs.
type fakeClient struct {
	mu  sync.Mutex
	gvk schema.GroupVersionKind
	// newZero produces an empty Object of the right kind so List / NotFound responses
	// can be constructed.
	newZero func() resource.Object
	// items holds the current state keyed by Name. Tests don't model namespaces.
	items map[string]resource.Object
	// counters for assertions.
	creates, updates, deletes int
	// nextRV is monotonically incremented so Update calls observe a fresh ResourceVersion.
	nextRV int
	// createHook lets a test inject failures on Create without re-implementing the whole
	// client.
	createHook func(obj resource.Object) error
}

func newFakeClient(gvk schema.GroupVersionKind, newZero func() resource.Object) *fakeClient {
	return &fakeClient{
		gvk:     gvk,
		newZero: newZero,
		items:   map[string]resource.Object{},
	}
}

func (c *fakeClient) create(obj resource.Object) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.unsafeCreate(obj)
}

func (c *fakeClient) unsafeCreate(obj resource.Object) error {
	name := obj.GetName()
	if _, exists := c.items[name]; exists {
		return apierrors.NewAlreadyExists(schema.GroupResource{Group: c.gvk.Group, Resource: c.gvk.Kind}, name)
	}
	c.nextRV++
	obj.SetResourceVersion(strconv.Itoa(c.nextRV))
	c.items[name] = deepCopyObject(obj)
	c.creates++
	return nil
}

func (c *fakeClient) Get(_ context.Context, ident resource.Identifier) (resource.Object, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	obj, ok := c.items[ident.Name]
	if !ok {
		return nil, apierrors.NewNotFound(schema.GroupResource{Group: c.gvk.Group, Resource: c.gvk.Kind}, ident.Name)
	}
	return deepCopyObject(obj), nil
}

func (c *fakeClient) GetInto(ctx context.Context, ident resource.Identifier, into resource.Object) error {
	got, err := c.Get(ctx, ident)
	if err != nil {
		return err
	}
	return copyObjectInto(got, into)
}

func (c *fakeClient) Create(_ context.Context, _ resource.Identifier, obj resource.Object, _ resource.CreateOptions) (resource.Object, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.createHook != nil {
		if err := c.createHook(obj); err != nil {
			return nil, err
		}
	}
	if err := c.unsafeCreate(obj); err != nil {
		return nil, err
	}
	return deepCopyObject(c.items[obj.GetName()]), nil
}

func (c *fakeClient) CreateInto(ctx context.Context, ident resource.Identifier, obj resource.Object, options resource.CreateOptions, into resource.Object) error {
	got, err := c.Create(ctx, ident, obj, options)
	if err != nil {
		return err
	}
	return copyObjectInto(got, into)
}

func (c *fakeClient) Update(_ context.Context, ident resource.Identifier, obj resource.Object, _ resource.UpdateOptions) (resource.Object, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.items[ident.Name]; !ok {
		return nil, apierrors.NewNotFound(schema.GroupResource{Group: c.gvk.Group, Resource: c.gvk.Kind}, ident.Name)
	}
	c.nextRV++
	obj.SetResourceVersion(strconv.Itoa(c.nextRV))
	c.items[ident.Name] = deepCopyObject(obj)
	c.updates++
	return deepCopyObject(obj), nil
}

func (c *fakeClient) UpdateInto(ctx context.Context, ident resource.Identifier, obj resource.Object, options resource.UpdateOptions, into resource.Object) error {
	got, err := c.Update(ctx, ident, obj, options)
	if err != nil {
		return err
	}
	return copyObjectInto(got, into)
}

func (c *fakeClient) Delete(_ context.Context, ident resource.Identifier, _ resource.DeleteOptions) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.items[ident.Name]; !ok {
		return apierrors.NewNotFound(schema.GroupResource{Group: c.gvk.Group, Resource: c.gvk.Kind}, ident.Name)
	}
	delete(c.items, ident.Name)
	c.deletes++
	return nil
}

func (c *fakeClient) List(_ context.Context, _ string, _ resource.ListOptions) (resource.ListObject, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	// Build a list by re-marshaling each item into the example list type. The reconciler
	// doesn't use List today — the implementation is here so future test additions don't
	// panic on a NotImplemented stub.
	out := []resource.Object{}
	for _, v := range c.items {
		out = append(out, deepCopyObject(v))
	}
	// Wrap in a minimal ListObject; callers only read GetItems.
	return &fakeList{items: out}, nil
}

// Unused methods of the Client interface return ErrNotImplemented so a test that
// accidentally relies on them fails loudly instead of looking like a real client.
func (c *fakeClient) ListInto(_ context.Context, _ string, _ resource.ListOptions, _ resource.ListObject) error {
	return errors.New("fakeClient.ListInto not implemented")
}
func (c *fakeClient) Patch(_ context.Context, _ resource.Identifier, _ resource.PatchRequest, _ resource.PatchOptions) (resource.Object, error) {
	return nil, errors.New("fakeClient.Patch not implemented")
}
func (c *fakeClient) PatchInto(_ context.Context, _ resource.Identifier, _ resource.PatchRequest, _ resource.PatchOptions, _ resource.Object) error {
	return errors.New("fakeClient.PatchInto not implemented")
}
func (c *fakeClient) Watch(_ context.Context, _ string, _ resource.WatchOptions) (resource.WatchResponse, error) {
	return nil, errors.New("fakeClient.Watch not implemented")
}
func (c *fakeClient) SubresourceRequest(_ context.Context, _ resource.Identifier, _ resource.CustomRouteRequestOptions) ([]byte, error) {
	return nil, errors.New("fakeClient.SubresourceRequest not implemented")
}

// fakeList is the minimal ListObject our List returns.
type fakeList struct {
	metav1.TypeMeta
	metav1.ListMeta
	items []resource.Object
}

func (l *fakeList) GetItems() []resource.Object      { return l.items }
func (l *fakeList) SetItems(items []resource.Object) { l.items = items }
func (l *fakeList) DeepCopyObject() runtime.Object   { return l }
func (l *fakeList) Copy() resource.ListObject        { return l }

// deepCopyObject roundtrips through JSON to produce an independent copy. The kinds we
// care about all have working JSON tags, and we don't need performance here.
func deepCopyObject(o resource.Object) resource.Object {
	if o == nil {
		return nil
	}
	raw, err := json.Marshal(o)
	if err != nil {
		panic(fmt.Sprintf("marshal: %v", err))
	}
	out := zeroOf(o)
	if err := json.Unmarshal(raw, out); err != nil {
		panic(fmt.Sprintf("unmarshal: %v", err))
	}
	return out
}

// copyObjectInto is the same JSON-roundtrip trick, but the caller supplies the destination
// — used to satisfy *Into methods on the Client interface.
func copyObjectInto(src, dst resource.Object) error {
	raw, err := json.Marshal(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, dst)
}

// zeroOf returns a freshly-allocated empty object of the same concrete type as `o`.
func zeroOf(o resource.Object) resource.Object {
	switch o.(type) {
	case *model.PrometheusRuleFile:
		return model.NewPrometheusRuleFile()
	case *folderv1.Folder:
		return &folderv1.Folder{}
	case *alertingv0.AlertRule:
		return &alertingv0.AlertRule{}
	case *alertingv0.RecordingRule:
		return &alertingv0.RecordingRule{}
	}
	panic(fmt.Sprintf("zeroOf: unsupported type %T", o))
}
