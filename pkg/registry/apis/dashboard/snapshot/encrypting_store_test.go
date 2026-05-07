package snapshot

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	secretcontracts "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

const testNamespace = "stacks-1"

// testCtx returns a context with a namespace populated, mirroring what the
// apiserver injects for namespaced-resource requests. encryptingStore errors
// out on missing namespace, so every test that exercises encrypt/decrypt must
// supply one.
func testCtx() context.Context {
	return request.WithNamespace(context.Background(), testNamespace)
}

func TestEncryptingStore_Create_EncryptsBeforePersistence(t *testing.T) {
	inner := &fakeInnerStore{}
	store := NewEncryptingStore(inner, &transformingEncryptionManager{})

	plaintext := map[string]interface{}{
		"title":  "test dashboard",
		"panels": []interface{}{map[string]interface{}{"id": float64(1)}},
	}
	in := &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{Dashboard: plaintext}}

	out, err := store.Create(testCtx(), in, nil, &metav1.CreateOptions{})
	require.NoError(t, err)

	require.NotNil(t, inner.lastCreated)
	persisted, ok := inner.lastCreated.(*dashv0.Snapshot)
	require.True(t, ok)
	assert.Empty(t, persisted.Spec.Dashboard, "plaintext Spec.Dashboard must not survive into the inner store")
	require.NotNil(t, persisted.Spec.DashboardEncrypted, "inner storage must receive Spec.DashboardEncrypted")
	assert.NotEmpty(t, persisted.Spec.DashboardEncrypted.EncryptedData, "encrypted data must be populated")
	assert.NotEmpty(t, persisted.Spec.DashboardEncrypted.DataKeyId, "data key id must be populated")

	outSnap, ok := out.(*dashv0.Snapshot)
	require.True(t, ok)
	assert.Equal(t, plaintext, outSnap.Spec.Dashboard, "Create should return decrypted plaintext")
	assert.Nil(t, outSnap.Spec.DashboardEncrypted, "returned object should not expose ciphertext field")
}

func TestEncryptingStore_Get_DecryptsCiphertext(t *testing.T) {
	plaintext := map[string]interface{}{"title": "round-trip"}
	encrypted := encryptForTest(t, plaintext)

	inner := &fakeInnerStore{
		getResult: &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{DashboardEncrypted: encrypted}},
	}
	store := NewEncryptingStore(inner, &transformingEncryptionManager{})

	out, err := store.Get(testCtx(), "name", &metav1.GetOptions{})
	require.NoError(t, err)
	snap := out.(*dashv0.Snapshot)
	assert.Equal(t, plaintext, snap.Spec.Dashboard)
	assert.Nil(t, snap.Spec.DashboardEncrypted, "ciphertext field should be cleared after decrypt")
}

func TestEncryptingStore_List_DoesNotDecrypt(t *testing.T) {
	// Snapshots List never returns the dashboard blob (legacy returns DTOs without
	// it; unified strips it in stripSensitiveFieldsFromList). The wrapper must not
	// waste KMS round-trips decrypting items whose payloads will be discarded.
	first := encryptForTest(t, map[string]interface{}{"title": "first"})
	inner := &fakeInnerStore{
		listResult: &dashv0.SnapshotList{Items: []dashv0.Snapshot{
			{Spec: dashv0.SnapshotSpec{DashboardEncrypted: first}},
		}},
	}
	mgr := &countingEncryptionManager{}
	store := NewEncryptingStore(inner, mgr)

	_, err := store.List(testCtx(), &internalversion.ListOptions{})
	require.NoError(t, err)
	assert.Equal(t, 0, mgr.decryptCalls, "List must not call Decrypt")
}

func TestEncryptingStore_Update_Rejected(t *testing.T) {
	// Snapshots are immutable; the wrapper must reject Update without touching
	// the inner store, matching SnapshotLegacyStore.Update.
	inner := &fakeInnerStore{}
	mgr := &countingEncryptionManager{}
	store := NewEncryptingStore(inner, mgr)

	_, _, err := store.Update(testCtx(), "name", nil, nil, nil, false, &metav1.UpdateOptions{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "immutable")
	assert.Equal(t, 0, mgr.encryptCalls)
	assert.Equal(t, 0, mgr.decryptCalls)
}

func TestEncryptingStore_Create_NilDashboardIsNoOp(t *testing.T) {
	// External-snapshot path (routes.go:250) sends an empty Spec.Dashboard.
	inner := &fakeInnerStore{}
	mgr := &countingEncryptionManager{}
	store := NewEncryptingStore(inner, mgr)

	in := &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{Dashboard: nil}}
	_, err := store.Create(testCtx(), in, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	assert.Equal(t, 0, mgr.encryptCalls, "encrypt must not be called for empty dashboard")

	persisted := inner.lastCreated.(*dashv0.Snapshot)
	assert.Nil(t, persisted.Spec.Dashboard)
	assert.Nil(t, persisted.Spec.DashboardEncrypted)
}

func TestEncryptingStore_Get_NilDashboardEncryptedIsPassThrough(t *testing.T) {
	// External snapshots are persisted with both Dashboard and DashboardEncrypted empty.
	inner := &fakeInnerStore{
		getResult: &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{}},
	}
	mgr := &countingEncryptionManager{}
	store := NewEncryptingStore(inner, mgr)

	out, err := store.Get(testCtx(), "name", &metav1.GetOptions{})
	require.NoError(t, err)
	snap := out.(*dashv0.Snapshot)
	assert.Empty(t, snap.Spec.Dashboard)
	assert.Nil(t, snap.Spec.DashboardEncrypted)
	assert.Equal(t, 0, mgr.decryptCalls, "decrypt must not be called when there is no ciphertext")
}

func TestEncryptingStore_Create_MissingNamespace_Errors(t *testing.T) {
	// EncryptionManager keys are namespace-scoped; encrypting without one would
	// silently collapse all tenants onto the same DEK. The wrapper must refuse.
	inner := &fakeInnerStore{}
	mgr := &countingEncryptionManager{}
	store := NewEncryptingStore(inner, mgr)

	in := &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{Dashboard: map[string]interface{}{"title": "x"}}}
	_, err := store.Create(context.Background(), in, nil, &metav1.CreateOptions{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "namespace")
	assert.Equal(t, 0, mgr.encryptCalls)
}

func TestEncryptingStore_Encrypt_PassesNamespace(t *testing.T) {
	// EncryptionManager.Encrypt is called with the namespace pulled from the
	// request context — assert it propagates so per-tenant DEKs are actually used.
	inner := &fakeInnerStore{}
	mgr := &capturingEncryptionManager{transformingEncryptionManager: transformingEncryptionManager{}}
	store := NewEncryptingStore(inner, mgr)

	in := &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{Dashboard: map[string]interface{}{"title": "x"}}}
	_, err := store.Create(testCtx(), in, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	assert.Equal(t, xkube.Namespace(testNamespace), mgr.lastEncryptNamespace)
}

// encryptForTest reproduces what NewEncryptingStore.Create writes into Spec.DashboardEncrypted.
func encryptForTest(t *testing.T, plaintext map[string]interface{}) *dashv0.SnapshotV0alpha1SpecDashboardEncrypted {
	t.Helper()
	inner := &fakeInnerStore{}
	store := NewEncryptingStore(inner, &transformingEncryptionManager{})
	in := &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{Dashboard: plaintext}}
	_, err := store.Create(testCtx(), in, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	return inner.lastCreated.(*dashv0.Snapshot).Spec.DashboardEncrypted
}

// transformingEncryptionManager prepends a sentinel byte so encrypt/decrypt are
// observably non-identity, and uses a fixed DataKeyID per namespace so the
// returned envelope round-trips.
type transformingEncryptionManager struct{}

const encMarker byte = 0xAB

func (transformingEncryptionManager) Encrypt(_ context.Context, namespace xkube.Namespace, payload []byte, _ secretcontracts.EncryptionOption) (secretcontracts.EncryptedPayload, error) {
	out := make([]byte, 0, len(payload)+1)
	out = append(out, encMarker)
	out = append(out, payload...)
	return secretcontracts.EncryptedPayload{DataKeyID: "dek-" + namespace.String(), EncryptedData: out}, nil
}

func (transformingEncryptionManager) Decrypt(_ context.Context, namespace xkube.Namespace, payload secretcontracts.EncryptedPayload, _ secretcontracts.EncryptionOption) ([]byte, error) {
	if payload.DataKeyID != "dek-"+namespace.String() {
		return nil, errors.New("data key id does not match namespace")
	}
	if len(payload.EncryptedData) == 0 || payload.EncryptedData[0] != encMarker {
		return nil, errors.New("not encrypted by this fake")
	}
	return payload.EncryptedData[1:], nil
}

func (transformingEncryptionManager) ConsolidateNamespace(_ context.Context, _ xkube.Namespace, _ []*secretcontracts.EncryptedValue) ([]*secretcontracts.EncryptedPayload, error) {
	return nil, nil
}

// countingEncryptionManager records call counts so tests can assert on them.
type countingEncryptionManager struct {
	transformingEncryptionManager
	encryptCalls int
	decryptCalls int
}

func (c *countingEncryptionManager) Encrypt(ctx context.Context, ns xkube.Namespace, payload []byte, opt secretcontracts.EncryptionOption) (secretcontracts.EncryptedPayload, error) {
	c.encryptCalls++
	return c.transformingEncryptionManager.Encrypt(ctx, ns, payload, opt)
}

func (c *countingEncryptionManager) Decrypt(ctx context.Context, ns xkube.Namespace, payload secretcontracts.EncryptedPayload, opt secretcontracts.EncryptionOption) ([]byte, error) {
	c.decryptCalls++
	return c.transformingEncryptionManager.Decrypt(ctx, ns, payload, opt)
}

// capturingEncryptionManager records the namespace passed to Encrypt so a test
// can assert that it propagates from the request context.
type capturingEncryptionManager struct {
	transformingEncryptionManager
	lastEncryptNamespace xkube.Namespace
}

func (c *capturingEncryptionManager) Encrypt(ctx context.Context, ns xkube.Namespace, payload []byte, opt secretcontracts.EncryptionOption) (secretcontracts.EncryptedPayload, error) {
	c.lastEncryptNamespace = ns
	return c.transformingEncryptionManager.Encrypt(ctx, ns, payload, opt)
}

// fakeInnerStore implements grafanarest.Storage so the wrapper has something to delegate to.
type fakeInnerStore struct {
	lastCreated runtime.Object
	getResult   runtime.Object
	listResult  runtime.Object
}

var _ grafanarest.Storage = (*fakeInnerStore)(nil)

func (f *fakeInnerStore) New() runtime.Object     { return &dashv0.Snapshot{} }
func (f *fakeInnerStore) NewList() runtime.Object { return &dashv0.SnapshotList{} }
func (f *fakeInnerStore) Destroy()                {}
func (f *fakeInnerStore) NamespaceScoped() bool   { return true }
func (f *fakeInnerStore) GetSingularName() string { return "snapshot" }
func (f *fakeInnerStore) ConvertToTable(_ context.Context, _ runtime.Object, _ runtime.Object) (*metav1.Table, error) {
	return &metav1.Table{}, nil
}
func (f *fakeInnerStore) Create(_ context.Context, obj runtime.Object, _ rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	// Capture a deep copy so later wrapper-side mutations (post-Create decrypt)
	// don't change what we observe from inside this fake.
	f.lastCreated = obj.DeepCopyObject()
	return obj, nil
}
func (f *fakeInnerStore) Update(_ context.Context, _ string, _ rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("fakeInnerStore.Update should not be called: wrapper rejects Update upstream")
}
func (f *fakeInnerStore) Get(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
	return f.getResult, nil
}
func (f *fakeInnerStore) List(_ context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	return f.listResult, nil
}
func (f *fakeInnerStore) Delete(_ context.Context, _ string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, true, nil
}
func (f *fakeInnerStore) DeleteCollection(_ context.Context, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	return nil, nil
}
