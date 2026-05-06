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
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/secrets"
)

func TestEncryptingStore_Create_EncryptsBeforePersistence(t *testing.T) {
	inner := &fakeInnerStore{}
	store := NewEncryptingStore(inner, &transformingSecretsService{})

	plaintext := map[string]interface{}{
		"title":  "test dashboard",
		"panels": []interface{}{map[string]interface{}{"id": float64(1)}},
	}
	in := &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{Dashboard: plaintext}}

	out, err := store.Create(context.Background(), in, nil, &metav1.CreateOptions{})
	require.NoError(t, err)

	require.NotNil(t, inner.lastCreated)
	persisted, ok := inner.lastCreated.(*dashv0.Snapshot)
	require.True(t, ok)
	assert.Empty(t, persisted.Spec.Dashboard, "plaintext Spec.Dashboard must not survive into the inner store")
	assert.NotEmpty(t, persisted.Spec.DashboardEncrypted, "inner storage must receive Spec.DashboardEncrypted")

	outSnap, ok := out.(*dashv0.Snapshot)
	require.True(t, ok)
	assert.Equal(t, plaintext, outSnap.Spec.Dashboard, "Create should return decrypted plaintext")
	assert.Empty(t, outSnap.Spec.DashboardEncrypted, "returned object should not expose ciphertext field")
}

func TestEncryptingStore_Get_DecryptsCiphertext(t *testing.T) {
	plaintext := map[string]interface{}{"title": "round-trip"}
	ciphertext := encryptForTest(t, plaintext)

	inner := &fakeInnerStore{
		getResult: &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{DashboardEncrypted: ciphertext}},
	}
	store := NewEncryptingStore(inner, &transformingSecretsService{})

	out, err := store.Get(context.Background(), "name", &metav1.GetOptions{})
	require.NoError(t, err)
	snap := out.(*dashv0.Snapshot)
	assert.Equal(t, plaintext, snap.Spec.Dashboard)
	assert.Empty(t, snap.Spec.DashboardEncrypted, "ciphertext field should be cleared after decrypt")
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
	secretsSvc := &countingSecretsService{}
	store := NewEncryptingStore(inner, secretsSvc)

	_, err := store.List(context.Background(), &internalversion.ListOptions{})
	require.NoError(t, err)
	assert.Equal(t, 0, secretsSvc.decryptCalls, "List must not call Decrypt")
}

func TestEncryptingStore_Update_Rejected(t *testing.T) {
	// Snapshots are immutable; the wrapper must reject Update without touching
	// the inner store, matching SnapshotLegacyStore.Update.
	inner := &fakeInnerStore{}
	secretsSvc := &countingSecretsService{}
	store := NewEncryptingStore(inner, secretsSvc)

	_, _, err := store.Update(context.Background(), "name", nil, nil, nil, false, &metav1.UpdateOptions{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "immutable")
	assert.Equal(t, 0, secretsSvc.encryptCalls)
	assert.Equal(t, 0, secretsSvc.decryptCalls)
}

func TestEncryptingStore_Create_NilDashboardIsNoOp(t *testing.T) {
	// External-snapshot path (routes.go:250) sends an empty Spec.Dashboard.
	inner := &fakeInnerStore{}
	secretsSvc := &countingSecretsService{}
	store := NewEncryptingStore(inner, secretsSvc)

	in := &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{Dashboard: nil}}
	_, err := store.Create(context.Background(), in, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	assert.Equal(t, 0, secretsSvc.encryptCalls, "encrypt must not be called for empty dashboard")

	persisted := inner.lastCreated.(*dashv0.Snapshot)
	assert.Nil(t, persisted.Spec.Dashboard)
	assert.Nil(t, persisted.Spec.DashboardEncrypted)
}

func TestEncryptingStore_Get_NilDashboardEncryptedIsPassThrough(t *testing.T) {
	// External snapshots are persisted with both Dashboard and DashboardEncrypted empty.
	inner := &fakeInnerStore{
		getResult: &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{}},
	}
	secretsSvc := &countingSecretsService{}
	store := NewEncryptingStore(inner, secretsSvc)

	out, err := store.Get(context.Background(), "name", &metav1.GetOptions{})
	require.NoError(t, err)
	snap := out.(*dashv0.Snapshot)
	assert.Empty(t, snap.Spec.Dashboard)
	assert.Empty(t, snap.Spec.DashboardEncrypted)
	assert.Equal(t, 0, secretsSvc.decryptCalls, "decrypt must not be called when there is no ciphertext")
}

// encryptForTest reproduces what NewEncryptingStore.Create writes into Spec.DashboardEncrypted.
func encryptForTest(t *testing.T, plaintext map[string]interface{}) []byte {
	t.Helper()
	inner := &fakeInnerStore{}
	store := NewEncryptingStore(inner, &transformingSecretsService{})
	in := &dashv0.Snapshot{Spec: dashv0.SnapshotSpec{Dashboard: plaintext}}
	_, err := store.Create(context.Background(), in, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	return inner.lastCreated.(*dashv0.Snapshot).Spec.DashboardEncrypted
}

// transformingSecretsService prepends a sentinel byte so encrypt/decrypt are
// observably non-identity (unlike fakes.FakeSecretsService which returns the
// payload unchanged).
type transformingSecretsService struct{}

const encMarker byte = 0xAB

func (transformingSecretsService) Encrypt(_ context.Context, payload []byte, _ secrets.EncryptionOptions) ([]byte, error) {
	out := make([]byte, 0, len(payload)+1)
	out = append(out, encMarker)
	out = append(out, payload...)
	return out, nil
}
func (transformingSecretsService) Decrypt(_ context.Context, payload []byte) ([]byte, error) {
	if len(payload) == 0 || payload[0] != encMarker {
		return nil, errors.New("not encrypted by this fake")
	}
	return payload[1:], nil
}
func (transformingSecretsService) EncryptJsonData(_ context.Context, _ map[string]string, _ secrets.EncryptionOptions) (map[string][]byte, error) {
	return nil, nil
}
func (transformingSecretsService) DecryptJsonData(_ context.Context, _ map[string][]byte) (map[string]string, error) {
	return nil, nil
}
func (transformingSecretsService) GetDecryptedValue(_ context.Context, _ map[string][]byte, _, fallback string) string {
	return fallback
}
func (transformingSecretsService) RotateDataKeys(_ context.Context) error    { return nil }
func (transformingSecretsService) ReEncryptDataKeys(_ context.Context) error { return nil }

// countingSecretsService records call counts so tests can assert on them.
type countingSecretsService struct {
	transformingSecretsService
	encryptCalls int
	decryptCalls int
}

func (c *countingSecretsService) Encrypt(ctx context.Context, payload []byte, opt secrets.EncryptionOptions) ([]byte, error) {
	c.encryptCalls++
	return c.transformingSecretsService.Encrypt(ctx, payload, opt)
}
func (c *countingSecretsService) Decrypt(ctx context.Context, payload []byte) ([]byte, error) {
	c.decryptCalls++
	return c.transformingSecretsService.Decrypt(ctx, payload)
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
